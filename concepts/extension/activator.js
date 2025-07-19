const vscode = require('vscode');
const path = require('path');
const { EditorService } = require('../editor/service');
const { LocaleService } = require('../locale/service');
const { ExtractionService } = require('../extraction/service');

/**
 * Extension activator that manages the lifecycle and event handling
 */
class ExtensionActivator {
    constructor() {
        this.editorService = new EditorService();
        this.localeService = new LocaleService();
        this.extractionService = new ExtractionService();
        this.disposables = [];
    }

    /**
     * Activate the extension
     * @param {vscode.ExtensionContext} context The VS Code extension context
     */
    activate(context) {
        console.log('ElementaryWatson i18n companion is now active!');

        // Register the change locale command
        this.registerChangeLocaleCommand();

        // Register the extract text command
        this.registerExtractTextCommand();

        // Set up event listeners
        this.setupEventListeners();

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
     * Set up event listeners for document changes and configuration changes
     */
    setupEventListeners() {
        // Listen for document saves
        const saveDisposable = vscode.workspace.onDidSaveTextDocument(async (document) => {
            if (this.editorService.isSupportedDocument(document)) {
                console.log(`\n💾 Save detected: ${path.basename(document.uri.fsPath)}`);
                await this.editorService.processDocument(document);
            }
        });

        // Listen for active editor changes
        const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(async (editor) => {
            if (editor && this.editorService.isSupportedDocument(editor.document)) {
                await this.editorService.processDocument(editor.document);
            }
        });

        // Listen for configuration changes
        const configChangeDisposable = vscode.workspace.onDidChangeConfiguration(async (event) => {
            if (event.affectsConfiguration('elementaryWatson.defaultLocale')) {
                // Refresh current document when locale changes
                await this.processActiveEditor();
            }
        });

        this.disposables.push(saveDisposable, editorChangeDisposable, configChangeDisposable);
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
            }
        }
    }

    /**
     * Deactivate the extension
     */
    deactivate() {
        // Dispose of all resources
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
        
        // Dispose of the editor service
        this.editorService.dispose();
    }
}

module.exports = { ExtensionActivator }; 