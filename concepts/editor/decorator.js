const vscode = require('vscode');

/**
 * Decorator for managing VS Code text decorations for translation displays
 */
class EditorDecorator {
    constructor() {
        this.activeDecorations = new Map();
        this.translationDecorationType = null;
    }

    /**
     * Initialize the decoration type
     * @returns {vscode.TextEditorDecorationType} The decoration type
     */
    initializeDecorationType() {
        if (!this.translationDecorationType) {
            this.translationDecorationType = vscode.window.createTextEditorDecorationType({
                after: {
                    margin: '0 0 0 1em',
                    color: '#888888',
                    fontStyle: 'italic'
                },
                rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
            });
        }
        return this.translationDecorationType;
    }

    /**
     * Create decorations for translation results
     * @param {vscode.TextDocument} document The VS Code document
     * @param {Array} translationResults Array of translation results with call info and values
     * @returns {Array} Array of decoration objects
     */
    createDecorations(document, translationResults) {
        const decorations = [];
        
        for (const result of translationResults) {
            const decoration = {
                range: new vscode.Range(
                    document.positionAt(result.end),
                    document.positionAt(result.end)
                ),
                renderOptions: {
                    after: {
                        contentText: `"${result.translationValue}"`,
                        color: '#888888',
                        fontStyle: 'italic',
                        border: '1px solid #888888',
                        borderRadius: '4px',
                        padding: '2px 4px',
                        margin: '0 2px',
                    }
                }
            };
            decorations.push(decoration);
        }

        return decorations;
    }

    /**
     * Apply decorations to an editor
     * @param {vscode.TextEditor} editor The VS Code text editor
     * @param {Array} decorations Array of decoration objects
     */
    applyDecorations(editor, decorations) {
        const decorationType = this.initializeDecorationType();
        editor.setDecorations(decorationType, decorations);
        this.activeDecorations.set(editor.document.uri.toString(), decorations);
    }

    /**
     * Clear decorations for a document
     * @param {vscode.TextEditor} editor The VS Code text editor
     */
    clearDecorations(editor) {
        if (this.translationDecorationType && this.activeDecorations.has(editor.document.uri.toString())) {
            editor.setDecorations(this.translationDecorationType, []);
            this.activeDecorations.delete(editor.document.uri.toString());
        }
    }

    /**
     * Clear all active decorations
     */
    clearAllDecorations() {
        this.activeDecorations.clear();
    }

    /**
     * Get the decoration type for disposal
     * @returns {vscode.TextEditorDecorationType|null} The decoration type
     */
    getDecorationType() {
        return this.translationDecorationType;
    }

    /**
     * Dispose of the decorator resources
     */
    dispose() {
        this.clearAllDecorations();
        if (this.translationDecorationType) {
            this.translationDecorationType.dispose();
            this.translationDecorationType = null;
        }
    }
}

module.exports = { EditorDecorator }; 