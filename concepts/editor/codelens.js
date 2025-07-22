const vscode = require('vscode');

/**
 * CodeLens provider for clickable translation labels
 */
class TranslationCodeLensProvider {
    constructor() {
        this._onDidChangeCodeLenses = new vscode.EventEmitter();
        this.onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;
        this.translationResults = [];
        this.document = null;
    }

    /**
     * Update translation results for the current document
     * @param {vscode.TextDocument} document The document
     * @param {Array} translationResults Array of translation results
     */
    updateTranslationResults(document, translationResults) {
        this.document = document;
        this.translationResults = translationResults || [];
        this._onDidChangeCodeLenses.fire();
    }

    /**
     * Provide CodeLens items for translation calls
     * @param {vscode.TextDocument} document The document
     * @returns {Array<vscode.CodeLens>} Array of CodeLens items
     */
    provideCodeLenses(document) {
        if (!this.document || document.uri.toString() !== this.document.uri.toString()) {
            return [];
        }

        const codeLenses = [];
        
        for (const result of this.translationResults) {
            // Position the CodeLens right after the method call
            const position = document.positionAt(result.end);
            const range = new vscode.Range(position, position);
            
            const codeLens = new vscode.CodeLens(range, {
                title: `$(globe)  Inspect Translation`,
                command: 'elementaryWatson.clickTranslationLabel',
                arguments: [result.methodName, document.uri.fsPath]
            });
            
            codeLenses.push(codeLens);
        }

        return codeLenses;
    }

    /**
     * Resolve a CodeLens (optional, can be used for performance optimization)
     * @param {vscode.CodeLens} codeLens The CodeLens to resolve
     * @returns {vscode.CodeLens} The resolved CodeLens
     */
    resolveCodeLens(codeLens) {
        return codeLens;
    }
}

module.exports = { TranslationCodeLensProvider }; 