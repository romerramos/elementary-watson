const vscode = require('vscode');
const path = require('path');
const { EditorService } = require('../editor/service');
const { LocaleService } = require('../locale/service');
const { ExtractionService } = require('../extraction/service');
const { SidebarService } = require('../sidebar/service');
const { SidebarTreeProvider } = require('../sidebar/provider');

/**
 * Extension activator that manages the lifecycle and event handling
 */
class ExtensionActivator {
    constructor() {
        this.editorService = new EditorService();
        this.localeService = new LocaleService();
        this.extractionService = new ExtractionService();
        this.sidebarService = new SidebarService();
        this.sidebarTreeProvider = new SidebarTreeProvider(this.sidebarService);
        this.disposables = [];
        this.treeView = null; // Tree view instance for title updates
        
        // Debounce utilities for content change updates
        this.documentUpdateTimeouts = new Map(); // Map of document URI to timeout
        this.DEBOUNCE_DELAY = 300; // ms to wait after typing stops (will be updated from config)
        
        // File watchers for translation files
        this.translationFileWatchers = [];
    }

    /**
     * Get the current debounce delay from configuration
     * @returns {number} Debounce delay in milliseconds
     */
    getDebounceDelay() {
        const config = vscode.workspace.getConfiguration('elementaryWatson');
        return config.get('updateDelay', 300);
    }

    /**
     * Check if real-time updates are enabled
     * @returns {boolean} True if real-time updates are enabled
     */
    isRealtimeUpdatesEnabled() {
        const config = vscode.workspace.getConfiguration('elementaryWatson');
        return config.get('realtimeUpdates', true);
    }

    /**
     * Debounce utility for document updates
     * @param {string} documentUri - The document URI
     * @param {Function} callback - The function to execute after debounce
     */
    debounceDocumentUpdate(documentUri, callback) {
        // Clear existing timeout for this document
        const existingTimeout = this.documentUpdateTimeouts.get(documentUri);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        // Set new timeout with current configured delay
        const delay = this.getDebounceDelay();
        const timeout = setTimeout(() => {
            this.documentUpdateTimeouts.delete(documentUri);
            callback();
        }, delay);

        this.documentUpdateTimeouts.set(documentUri, timeout);
    }

    /**
     * Check if a document change might affect translation calls or their positions
     * @param {vscode.TextDocumentChangeEvent} event - The change event
     * @returns {boolean} True if update might be needed
     */
    shouldUpdateForChange(event) {
        const changes = event.contentChanges;
        if (changes.length === 0) return false;

        // If any change affects multiple lines or contains 'm.' pattern, we should update
        for (const change of changes) {
            // Check if change spans multiple lines (affects positioning)
            const lineChange = change.range.end.line - change.range.start.line;
            const hasNewlines = change.text.includes('\n') || change.text.includes('\r');
            
            if (lineChange > 0 || hasNewlines) {
                return true; // Multi-line changes always affect positioning
            }

            // Check if the change might affect translation calls
            const oldText = change.rangeLength > 0 ? true : false; // Text was deleted
            const newText = change.text;
            
            if (oldText || newText.includes('m.') || newText.includes('()')) {
                return true; // Potential translation call modification
            }
        }

        return false;
    }

    /**
     * Activate the extension
     * @param {vscode.ExtensionContext} context The VS Code extension context
     */
    activate(context) {
        console.log('ElementaryWatson i18n companion is now active!');

        // Register the sidebar tree provider
        this.registerSidebar();
        
        // Connect tree view to provider for title updates
        this.sidebarTreeProvider.setTreeView(this.treeView);

        // Register the change locale command
        this.registerChangeLocaleCommand();

        // Register the extract text command
        this.registerExtractTextCommand();

        // Register sidebar commands
        this.registerSidebarCommands();

        // Set up event listeners
        this.setupEventListeners();

        // Set up translation file watchers
        this.setupTranslationFileWatchers();

        // Process currently active editor on activation
        this.processActiveEditor();

        // Add all disposables to context
        context.subscriptions.push(...this.disposables);

        // Add the decorator's decoration type to disposables
        const decorationType = this.editorService.getDecorator().getDecorationType();
        if (decorationType) {
            context.subscriptions.push(decorationType);
        }
    }

    /**
     * Register the sidebar tree provider
     */
    registerSidebar() {
        // Create tree view with proper title support
        this.treeView = vscode.window.createTreeView('elementaryWatsonSidebar', {
            treeDataProvider: this.sidebarTreeProvider,
            showCollapseAll: false
        });
        
        // Add to disposables for cleanup
        this.disposables.push(this.treeView);
        
        // Set context to show sidebar
        vscode.commands.executeCommand('setContext', 'elementaryWatson.showSidebar', true);
    }

    /**
     * Register sidebar-related commands
     */
    registerSidebarCommands() {
        // Register refresh command
        const refreshCommand = vscode.commands.registerCommand('elementaryWatson.refreshSidebar', async () => {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor && this.editorService.isSupportedDocument(activeEditor.document)) {
                // Force refresh even if it's a translation file when manually triggered
                await this.sidebarTreeProvider.refresh(activeEditor.document, true);
            } else {
                await this.sidebarTreeProvider.refresh(null);
            }
        });

        // Register open translation file command
        const openTranslationCommand = vscode.commands.registerCommand('elementaryWatson.openTranslationFile', 
            async (workspacePath, locale, key) => {
                await this.sidebarService.openTranslationFile(workspacePath, locale, key);
            }
        );

        this.disposables.push(refreshCommand, openTranslationCommand);
    }

    /**
     * Register the change locale command
     */
    registerChangeLocaleCommand() {
        const changeLocaleCommand = vscode.commands.registerCommand('elementaryWatson.changeLocale', async () => {
            const currentLocale = this.localeService.getCurrentLocale();
            const newLocale = await vscode.window.showInputBox({
                prompt: 'Enter the locale code (e.g., en, es, fr)',
                value: currentLocale,
                placeHolder: 'en'
            });

            if (newLocale && newLocale !== currentLocale) {
                await this.localeService.updateLocale(newLocale);
                vscode.window.showInformationMessage(`Locale changed to: ${newLocale}`);
                
                // Refresh all open documents
                await this.processActiveEditor();
            }
        });

        this.disposables.push(changeLocaleCommand);
    }

    /**
     * Register the extract text command
     */
    registerExtractTextCommand() {
        const extractTextCommand = vscode.commands.registerCommand('elementaryWatson.extractText', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active text editor');
                return;
            }

            if (!this.editorService.isSupportedDocument(editor.document)) {
                vscode.window.showErrorMessage('Text extraction is only supported in JavaScript, TypeScript, and Svelte files');
                return;
            }

            const success = await this.extractionService.extractSelectedText(editor);
            if (success) {
                vscode.window.showInformationMessage('Text extracted successfully to locale files');
            }
        });

        this.disposables.push(extractTextCommand);
    }

    /**
     * Set up file system watchers for translation files
     */
    async setupTranslationFileWatchers() {
        try {
            // Clear existing watchers
            this.disposeTranslationFileWatchers();
            
            if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                return;
            }

            const workspaceFolder = vscode.workspace.workspaceFolders[0];
            const workspacePath = workspaceFolder.uri.fsPath;
            
            // Get available locales
            const availableLocales = await this.sidebarService.getAvailableLocales(workspacePath);
            
            // Create file watchers for each locale
            for (const locale of availableLocales) {
                const translationPath = this.localeService.resolveTranslationPath(workspacePath, locale);
                const relativePath = path.relative(workspacePath, translationPath);
                
                // Create a file system watcher for this specific translation file
                const watcher = vscode.workspace.createFileSystemWatcher(
                    new vscode.RelativePattern(workspaceFolder, relativePath),
                    false, // Don't ignore creates
                    false, // Don't ignore changes
                    false  // Don't ignore deletes
                );
                
                // Handle file changes
                watcher.onDidChange(async () => {
                    await this.handleTranslationFileChange(locale);
                });
                
                // Handle file creation (useful for new locale files)
                watcher.onDidCreate(async () => {
                    await this.handleTranslationFileChange(locale);
                });
                
                // Handle file deletion
                watcher.onDidDelete(async () => {
                    await this.handleTranslationFileChange(locale);
                });
                
                this.translationFileWatchers.push(watcher);
                this.disposables.push(watcher);
                
                console.log(`🔍 Watching translation file: ${relativePath}`);
            }
            
        } catch (error) {
            console.error('Error setting up translation file watchers:', error);
        }
    }

    /**
     * Handle changes to translation files
     * @param {string} locale The locale of the changed file
     */
    async handleTranslationFileChange(locale) {
        try {
            console.log(`🔄 Translation file changed for locale: ${locale}`);
            
            const activeEditor = vscode.window.activeTextEditor;
            
            // Check if sidebar has preserved context (from a previous non-translation file)
            const hasPreservedContext = this.sidebarTreeProvider.currentFilePath && 
                                      this.sidebarTreeProvider.translationData.length > 0;
            
            if (hasPreservedContext) {
                // Refresh the preserved context with updated translation values
                const preservedFilePath = this.sidebarTreeProvider.currentFilePath;
                try {
                    const preservedDocument = await vscode.workspace.openTextDocument(preservedFilePath);
                    
                    // Update editor decorations if the preserved file is currently active
                    if (activeEditor && activeEditor.document.uri.fsPath === preservedFilePath) {
                        await this.editorService.processDocument(activeEditor.document);
                    }
                    
                    // Force refresh sidebar with the preserved context to get updated translation values
                    await this.sidebarTreeProvider.refresh(preservedDocument, true);
                    
                    console.log(`📋 Updated preserved context for: ${path.basename(preservedFilePath)}`);
                } catch (error) {
                    console.error('Error refreshing preserved context:', error);
                    // Fallback: just refresh the data structure
                    this.sidebarTreeProvider._onDidChangeTreeData.fire();
                }
            } else {
                // No preserved context, refresh current editor if it's supported
                if (activeEditor && this.editorService.isSupportedDocument(activeEditor.document)) {
                    await this.editorService.processDocument(activeEditor.document);
                    await this.sidebarTreeProvider.refresh(activeEditor.document);
                }
            }
            
        } catch (error) {
            console.error('Error handling translation file change:', error);
        }
    }

    /**
     * Dispose of translation file watchers
     */
    disposeTranslationFileWatchers() {
        for (const watcher of this.translationFileWatchers) {
            watcher.dispose();
        }
        this.translationFileWatchers = [];
    }

    /**
     * Set up event listeners for document changes and configuration changes
     */
    setupEventListeners() {
        // Listen for document saves
        const saveDisposable = vscode.workspace.onDidSaveTextDocument(async (document) => {
            if (this.editorService.isSupportedDocument(document)) {
                console.log(`\n💾 Save detected: ${path.basename(document.uri.fsPath)}`);
                
                // Cancel any pending debounced update for this document since we're doing a full update
                const existingTimeout = this.documentUpdateTimeouts.get(document.uri.toString());
                if (existingTimeout) {
                    clearTimeout(existingTimeout);
                    this.documentUpdateTimeouts.delete(document.uri.toString());
                }
                
                await this.editorService.processDocument(document);
                
                // Refresh sidebar for the saved document
                await this.sidebarTreeProvider.refresh(document);
            }
        });

        // Listen for active editor changes
        const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(async (editor) => {
            if (editor && this.editorService.isSupportedDocument(editor.document)) {
                await this.editorService.processDocument(editor.document);
                
                // Refresh sidebar for the new active document (don't force if it's a translation file)
                await this.sidebarTreeProvider.refresh(editor.document);
            } else if (editor && await this.sidebarService.isTranslationFile(editor.document)) {
                // Don't clear sidebar when switching to translation files - preserve context
                // Call refresh to update UI with preserved data, but don't force update
                await this.sidebarTreeProvider.refresh(editor.document);
            } else {
                // Clear sidebar if no supported document is active and it's not a translation file
                await this.sidebarTreeProvider.refresh(null);
            }
        });

        // Listen for document content changes (new!)
        const documentChangeDisposable = vscode.workspace.onDidChangeTextDocument(async (event) => {
            const document = event.document;
            
            // Check if real-time updates are enabled
            if (!this.isRealtimeUpdatesEnabled()) {
                return;
            }
            
            // Only process supported documents
            if (!this.editorService.isSupportedDocument(document)) {
                return;
            }

            // Only update if the change might affect translation calls or positions
            if (!this.shouldUpdateForChange(event)) {
                return;
            }

            // Debounce the update to avoid too frequent processing
            this.debounceDocumentUpdate(document.uri.toString(), async () => {
                try {
                    // Double-check if real-time updates are still enabled (user might have changed setting)
                    if (!this.isRealtimeUpdatesEnabled()) {
                        return;
                    }
                    
                    console.log(`\n✏️  Content change detected: ${path.basename(document.uri.fsPath)} (debounced)`);
                    await this.editorService.processDocument(document);
                    
                    // Refresh sidebar for the changed document
                    await this.sidebarTreeProvider.refresh(document);
                } catch (error) {
                    console.error('Error processing document content change:', error);
                }
            });
        });

        // Listen for configuration changes
        const configChangeDisposable = vscode.workspace.onDidChangeConfiguration(async (event) => {
            if (event.affectsConfiguration('elementaryWatson.defaultLocale')) {
                // Refresh current document when locale changes
                await this.processActiveEditor();
                
                // Refresh sidebar when locale changes
                const activeEditor = vscode.window.activeTextEditor;
                if (activeEditor && this.editorService.isSupportedDocument(activeEditor.document)) {
                    await this.sidebarTreeProvider.refresh(activeEditor.document);
                }
            }
            
            if (event.affectsConfiguration('elementaryWatson.realtimeUpdates')) {
                const enabled = this.isRealtimeUpdatesEnabled();
                console.log(`🔄 Real-time updates ${enabled ? 'enabled' : 'disabled'}`);
                
                if (!enabled) {
                    // Clear all pending timeouts when real-time updates are disabled
                    for (const timeout of this.documentUpdateTimeouts.values()) {
                        clearTimeout(timeout);
                    }
                    this.documentUpdateTimeouts.clear();
                }
            }
            
            if (event.affectsConfiguration('elementaryWatson.updateDelay')) {
                const delay = this.getDebounceDelay();
                console.log(`⏱️  Update delay changed to ${delay}ms`);
            }
        });

        // Listen for workspace folder changes to refresh translation file watchers
        const workspaceFoldersChangeDisposable = vscode.workspace.onDidChangeWorkspaceFolders(async () => {
            console.log('📁 Workspace folders changed, refreshing translation file watchers');
            await this.setupTranslationFileWatchers();
        });

        this.disposables.push(saveDisposable, editorChangeDisposable, documentChangeDisposable, configChangeDisposable, workspaceFoldersChangeDisposable);
    }

    /**
     * Process the currently active editor
     * @returns {Promise<void>}
     */
    async processActiveEditor() {
        if (vscode.window.activeTextEditor) {
            const document = vscode.window.activeTextEditor.document;
            if (this.editorService.isSupportedDocument(document)) {
                await this.editorService.processDocument(document);
                
                // Refresh sidebar for the active document
                await this.sidebarTreeProvider.refresh(document);
            }
        } else {
            // Clear sidebar if no active editor
            await this.sidebarTreeProvider.refresh(null);
        }
    }

    /**
     * Deactivate the extension
     */
    deactivate() {
        // Clear all pending timeouts
        for (const timeout of this.documentUpdateTimeouts.values()) {
            clearTimeout(timeout);
        }
        this.documentUpdateTimeouts.clear();
        
        // Dispose of translation file watchers
        this.disposeTranslationFileWatchers();
        
        // Dispose of other resources
        this.editorService.dispose();
    }
}

module.exports = { ExtensionActivator }; 