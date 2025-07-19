const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { humanId } = require('human-id');
const { LocaleService } = require('../locale/service');
const { TranslationRepository } = require('../translation/repository');

/**
 * Service for extracting strings and adding them to locale files
 */
class ExtractionService {
    constructor() {
        this.localeService = new LocaleService();
        this.translationRepository = new TranslationRepository();
    }

    /**
     * Extract selected text and add to locale files
     * @param {vscode.TextEditor} editor The active text editor
     * @returns {Promise<boolean>} True if extraction was successful
     */
    async extractSelectedText(editor) {
        try {
            if (!editor || !editor.selection || editor.selection.isEmpty) {
                vscode.window.showErrorMessage('Please select text to extract');
                return false;
            }

            const selectedText = editor.document.getText(editor.selection).trim();
            if (!selectedText) {
                vscode.window.showErrorMessage('Selected text is empty');
                return false;
            }

            const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder found');
                return false;
            }

            const workspacePath = workspaceFolder.uri.fsPath;

            // Check if the exact text already exists in translations
            const existingKey = await this.findExistingTranslation(workspacePath, selectedText);
            if (existingKey) {
                // Auto-interpolate with existing key without asking
                return await this.replaceTextWithKey(editor, existingKey);
            }

            // Generate new key
            const newKey = await this.generateUniqueKey(workspacePath);
            if (!newKey) {
                vscode.window.showErrorMessage('Failed to generate unique key');
                return false;
            }

            // Get interpolation choice from user (showing the real key name)
            const interpolationType = await this.getUserInterpolationChoice(editor.document.languageId, newKey);
            if (!interpolationType) {
                return false; // User cancelled
            }

            // Add to locale files
            const success = await this.addToLocaleFiles(workspacePath, newKey, selectedText);
            if (!success) {
                vscode.window.showErrorMessage('Failed to update locale files');
                return false;
            }

            // Replace selected text with key call
            const keyCall = interpolationType === 'template' ? `{m.${newKey}()}` : `m.${newKey}()`;
            return await this.replaceSelectedText(editor, keyCall);

        } catch (error) {
            console.error('Error during text extraction:', error);
            vscode.window.showErrorMessage(`Failed to extract text: ${error.message}`);
            return false;
        }
    }

    /**
     * Find if the exact text already exists in any translation
     * @param {string} workspacePath The workspace root path
     * @param {string} text The text to search for
     * @returns {Promise<string|null>} The existing key or null if not found
     */
    async findExistingTranslation(workspacePath, text) {
        try {
            const inlangSettings = this.localeService.loadInlangSettings(workspacePath);
            const baseLocale = inlangSettings?.baseLocale || 'en';

            // Check in base locale first
            const baseTranslationPath = this.localeService.resolveTranslationPath(workspacePath, baseLocale);
            const baseTranslations = await this.translationRepository.loadTranslations(baseTranslationPath, baseLocale);
            
            if (baseTranslations) {
                for (const [key, value] of Object.entries(baseTranslations)) {
                    if (value === text) {
                        return key;
                    }
                }
            }

            return null;
        } catch (error) {
            console.error('Error finding existing translation:', error);
            return null;
        }
    }

    /**
     * Generate a unique human-readable key
     * @param {string} workspacePath The workspace root path
     * @returns {Promise<string|null>} The generated unique key or null if failed
     */
    async generateUniqueKey(workspacePath) {
        try {
            const inlangSettings = this.localeService.loadInlangSettings(workspacePath);
            const baseLocale = inlangSettings?.baseLocale || 'en';
            const baseTranslationPath = this.localeService.resolveTranslationPath(workspacePath, baseLocale);
            const baseTranslations = await this.translationRepository.loadTranslations(baseTranslationPath, baseLocale) || {};

            // Try to generate unique key up to 10 times
            for (let i = 0; i < 10; i++) {
                const key = humanId({
                    separator: '_',
                    capitalize: false,
                    adjectiveCount: 2,
                    addAdverb: false
                });

                if (!baseTranslations[key]) {
                    return key;
                }
            }

            // If we couldn't generate a unique key, add a timestamp
            const key = humanId({
                separator: '_',
                capitalize: false,
                adjectiveCount: 2,
                addAdverb: false
            });
            return `${key}_${Date.now()}`;

        } catch (error) {
            console.error('Error generating unique key:', error);
            return null;
        }
    }

    /**
     * Get user's choice for interpolation type
     * @param {string} languageId The language ID of the current file
     * @param {string} [keyName] The actual key name to show in options (optional)
     * @returns {Promise<string|null>} 'template' for {m.key()}, 'code' for m.key(), or null if cancelled
     */
    async getUserInterpolationChoice(languageId, keyName = 'key') {
        const isSvelteTemplate = languageId === 'svelte';
        
        const options = [
            {
                label: isSvelteTemplate ? `{m.${keyName}()} - For Svelte template (recommended)` : `m.${keyName}() - For JavaScript/TypeScript code (recommended)`,
                value: isSvelteTemplate ? 'template' : 'code'
            },
            {
                label: isSvelteTemplate ? `m.${keyName}() - For JavaScript/TypeScript code` : `{m.${keyName}()} - For Svelte template`,
                value: isSvelteTemplate ? 'code' : 'template'
            }
        ];

        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: 'Choose interpolation format for the extracted text'
        });

        return selected ? selected.value : null;
    }

    /**
     * Add the new key-value pair to all locale files
     * @param {string} workspacePath The workspace root path
     * @param {string} key The translation key
     * @param {string} value The translation value
     * @returns {Promise<boolean>} True if successful
     */
    async addToLocaleFiles(workspacePath, key, value) {
        try {
            const inlangSettings = this.localeService.loadInlangSettings(workspacePath);
            const availableLocales = inlangSettings?.locales || ['en'];
            const baseLocale = inlangSettings?.baseLocale || 'en';

            // Save base locale first
            await this.updateLocaleFile(workspacePath, baseLocale, key, value);
            
            // Wait 2 seconds as requested
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Save other locales with empty strings
            for (const locale of availableLocales) {
                if (locale !== baseLocale) {
                    await this.updateLocaleFile(workspacePath, locale, key, '');
                }
            }

            return true;
        } catch (error) {
            console.error('Error adding to locale files:', error);
            return false;
        }
    }

    /**
     * Update a specific locale file with new key-value pair
     * @param {string} workspacePath The workspace root path
     * @param {string} locale The locale to update
     * @param {string} key The translation key
     * @param {string} value The translation value
     * @returns {Promise<void>}
     */
    async updateLocaleFile(workspacePath, locale, key, value) {
        try {
            const translationPath = this.localeService.resolveTranslationPath(workspacePath, locale);
            
            // Load existing translations or create empty object
            let translations = {};
            if (fs.existsSync(translationPath)) {
                const content = fs.readFileSync(translationPath, 'utf8');
                translations = JSON.parse(content);
            } else {
                // Ensure directory exists
                const dir = path.dirname(translationPath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
            }

            // Add new key-value pair
            translations[key] = value;

            // Sort keys alphabetically for consistency
            const sortedTranslations = {};
            Object.keys(translations).sort().forEach(sortedKey => {
                sortedTranslations[sortedKey] = translations[sortedKey];
            });

            // Write back to file
            fs.writeFileSync(translationPath, JSON.stringify(sortedTranslations, null, 2) + '\n', 'utf8');
            
            console.log(`✅ Updated ${locale} locale file: ${key} = "${value}"`);
        } catch (error) {
            console.error(`Error updating locale file for ${locale}:`, error);
            throw error;
        }
    }

    /**
     * Replace selected text with the key call
     * @param {vscode.TextEditor} editor The text editor
     * @param {string} replacement The replacement text
     * @returns {Promise<boolean>} True if successful
     */
    async replaceSelectedText(editor, replacement) {
        try {
            await editor.edit(editBuilder => {
                editBuilder.replace(editor.selection, replacement);
            });
            
            // Focus back on the editor
            await vscode.window.showTextDocument(editor.document, editor.viewColumn);
            
            return true;
        } catch (error) {
            console.error('Error replacing selected text:', error);
            return false;
        }
    }

    /**
     * Replace text with existing key
     * @param {vscode.TextEditor} editor The text editor
     * @param {string} existingKey The existing translation key
     * @returns {Promise<boolean>} True if successful
     */
    async replaceTextWithKey(editor, existingKey) {
        const interpolationType = await this.getUserInterpolationChoice(editor.document.languageId, existingKey);
        if (!interpolationType) {
            return false;
        }

        const keyCall = interpolationType === 'template' ? `{m.${existingKey}()}` : `m.${existingKey}()`;
        return await this.replaceSelectedText(editor, keyCall);
    }
}

module.exports = { ExtractionService }; 