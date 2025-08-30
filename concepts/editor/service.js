const vscode = require('vscode');
const { TranslationService } = require('../translation/service');
const { LocaleService } = require('../locale/service');
const { EditorDecorator } = require('./decorator');
const { TranslationCodeLensProvider } = require('./codelens');

/**
 * Service for processing VS Code documents and managing translation displays
 */
class EditorService {
    constructor() {
        this.translationService = new TranslationService();
        this.localeService = new LocaleService();
        this.editorDecorator = new EditorDecorator();
        this.codeLensProvider = new TranslationCodeLensProvider();
    }

    /**
     * Check if document is supported (JavaScript, JavaScript with JSX, TypeScript, TypeScript with JSX, or Svelte)
     * @param {vscode.TextDocument} document 
     * @returns {boolean} True if the document is supported
     */
    isSupportedDocument(document) {
        const languageId = document.languageId;
        return ['javascript', 'javascriptreact', 'typescript', 'typescriptreact', 'svelte'].includes(languageId);
    }

    /**
     * Process a document to find and display translations
     * @param {vscode.TextDocument} document The VS Code document to process
     * @returns {Promise<void>}
     */
    async processDocument(document) {
        try {
            const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
            if (!editor) return;

            // Clear previous decorations
            this.editorDecorator.clearDecorations(editor);

            const text = document.getText();
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
            if (!workspaceFolder) return;

            // Find all m.methodName() calls
            const translationCalls = this.translationService.findTranslationCalls(text);
            if (translationCalls.length === 0) {
                // Clear CodeLens when no translation calls are found
                this.codeLensProvider.updateTranslationResults(document, []);
                return;
            }

            // Load translations using the current locale
            const currentLocale = this.localeService.getCurrentLocale();
            const translations = await this.translationService.loadTranslationsForLocale(
                workspaceFolder.uri.fsPath, 
                currentLocale
            );

            // Process translation calls to get resolved values with warning states
            // Note: We process even if translations is null to show warning labels
            const translationResults = await this.translationService.processTranslationCallsWithWarnings(
                translationCalls, 
                translations || {}, 
                workspaceFolder.uri.fsPath,
                currentLocale
            );
            
            if (translationResults.length === 0) {
                // Clear CodeLens when no translation results are found
                this.codeLensProvider.updateTranslationResults(document, []);
                return;
            }

            // Create and apply decorations for translation values
            const decorations = this.editorDecorator.createDecorations(document, translationResults);
            this.editorDecorator.applyDecorations(editor, decorations);

            // Update CodeLens provider for clickable navigation
            this.codeLensProvider.updateTranslationResults(document, translationResults);

            // Log the results
            const translationValues = translationResults.map(result => {
                if (result.warningType === 'noLocale') {
                    return `${result.methodName}: ❌ no locale defined`;
                } else if (result.warningType === 'missingLocale') {
                    return `${result.methodName}: ⚠️ "${result.translationValue}" (missing in ${currentLocale}, found in ${result.foundInLocale})`;
                } else {
                    return `${result.methodName}: "${result.translationValue}"`;
                }
            });
            console.log(`💡 Updated translation labels and navigation (${currentLocale}): ${translationValues.join(', ')}`);

        } catch (error) {
            console.error('Error processing document:', error);
        }
    }

    /**
     * Get the editor decorator instance
     * @returns {EditorDecorator} The editor decorator
     */
    getDecorator() {
        return this.editorDecorator;
    }

    /**
     * Get the CodeLens provider instance
     * @returns {TranslationCodeLensProvider} The CodeLens provider instance
     */
    getCodeLensProvider() {
        return this.codeLensProvider;
    }

    /**
     * Dispose of the service resources
     */
    dispose() {
        this.editorDecorator.dispose();
    }
}

module.exports = { EditorService }; 