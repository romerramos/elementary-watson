const vscode = require('vscode');
const { TranslationService } = require('../translation/service');
const { LocaleService } = require('../locale/service');
const { EditorDecorator } = require('./decorator');

/**
 * Service for processing VS Code documents and managing translation displays
 */
class EditorService {
    constructor() {
        this.translationService = new TranslationService();
        this.localeService = new LocaleService();
        this.editorDecorator = new EditorDecorator();
    }

    /**
     * Check if document is supported (JavaScript, TypeScript, or Svelte)
     * @param {vscode.TextDocument} document 
     * @returns {boolean} True if the document is supported
     */
    isSupportedDocument(document) {
        const languageId = document.languageId;
        return ['javascript', 'typescript', 'svelte'].includes(languageId);
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
            if (translationCalls.length === 0) return;

            // Load translations using the current locale
            const currentLocale = this.localeService.getCurrentLocale();
            const translations = await this.translationService.loadTranslationsForLocale(
                workspaceFolder.uri.fsPath, 
                currentLocale
            );
            if (!translations) return;

            // Process translation calls to get resolved values
            const translationResults = this.translationService.processTranslationCalls(translationCalls, translations);
            if (translationResults.length === 0) return;

            // Create and apply decorations
            const decorations = this.editorDecorator.createDecorations(document, translationResults);
            this.editorDecorator.applyDecorations(editor, decorations);

            // Log the results
            const translationValues = translationResults.map(result => 
                `${result.methodName}: "${result.translationValue}"`
            );
            console.log(`💡 Updated translation labels (${currentLocale}): ${translationValues.join(', ')}`);

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
     * Dispose of the service resources
     */
    dispose() {
        this.editorDecorator.dispose();
    }
}

module.exports = { EditorService }; 