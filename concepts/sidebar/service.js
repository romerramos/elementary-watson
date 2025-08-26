const vscode = require('vscode');
const { TranslationService } = require('../translation/service');
const { LocaleService } = require('../locale/service');

/**
 * Service for managing sidebar translation data
 */
class SidebarService {
    constructor() {
        this.translationService = new TranslationService();
        this.localeService = new LocaleService();
    }

    /**
     * Get all translation data for the current document
     * @param {vscode.TextDocument} document The current document
     * @returns {Promise<Array>} Array of translation key objects with locale data
     */
    async getTranslationData(document) {
        try {
            if (!document) return [];

            const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
            if (!workspaceFolder) return [];

            const workspacePath = workspaceFolder.uri.fsPath;
            const text = document.getText();

            // Find all m.methodName() calls in the current file
            const translationCalls = this.translationService.findTranslationCalls(text);
            if (translationCalls.length === 0) return [];

            // Get available locales from inlang settings or fallback
            const availableLocales = await this.getAvailableLocales(workspacePath);
            
            // Create translation data structure
            const translationData = [];

            for (const call of translationCalls) {
                const keyData = {
                    key: call.methodName,
                    locales: []
                };

                for (const locale of availableLocales) {
                    const translations = await this.translationService.loadTranslationsForLocale(workspacePath, locale);
                    const translationValue = translations ? this.translationService.getTranslation(translations, call.methodName) : null;
                    
                    // Only add locale data if the translation exists (not null/undefined)
                    if (translationValue !== null) {
                        keyData.locales.push({
                            locale,
                            value: translationValue,
                            workspacePath
                        });
                    }
                }

                // Only add keys that have at least one translation
                if (keyData.locales.length > 0) {
                    translationData.push(keyData);
                }
            }

            return translationData;

        } catch (error) {
            console.error('Error getting translation data for sidebar:', error);
            return [];
        }
    }

    /**
     * Get available locales from inlang settings or fallback
     * @param {string} workspacePath The workspace root path
     * @returns {Promise<Array<string>>} Array of available locale codes
     */
    async getAvailableLocales(workspacePath) {
        try {
            const inlangSettings = this.localeService.loadInlangSettings(workspacePath);
            
            if (inlangSettings && inlangSettings.locales) {
                return inlangSettings.locales;
            }

            // Fallback: try to detect existing locale files
            const fs = require('fs');
            const path = require('path');
            
            const messagesDir = path.join(workspacePath, 'messages');
            if (fs.existsSync(messagesDir)) {
                const files = fs.readdirSync(messagesDir);
                const locales = files
                    .filter(file => file.endsWith('.json'))
                    .map(file => path.basename(file, '.json'));
                
                if (locales.length > 0) {
                    return locales;
                }
            }

            // Ultimate fallback
            return ['en'];

        } catch (error) {
            console.error('Error getting available locales:', error);
            return ['en'];
        }
    }

    /**
     * Open a translation file and navigate to a specific key
     * @param {string} workspacePath The workspace root path
     * @param {string} locale The locale to open
     * @param {string} key The translation key to navigate to
     * @returns {Promise<void>}
     */
    async openTranslationFile(workspacePath, locale, key) {
        try {
            const translationPath = this.localeService.resolveTranslationPath(workspacePath, locale);
            
            // Check if file exists
            const fs = require('fs');
            if (!fs.existsSync(translationPath)) {
                vscode.window.showErrorMessage(`Translation file not found: ${translationPath}`);
                return;
            }

            // Open the file
            const document = await vscode.workspace.openTextDocument(translationPath);
            const editor = await vscode.window.showTextDocument(document);

            // Find the key in the file and navigate to it
            await this.navigateToKey(editor, key);

        } catch (error) {
            console.error('Error opening translation file:', error);
            vscode.window.showErrorMessage(`Failed to open translation file: ${error.message}`);
        }
    }

        /**
     * Navigate to a specific key in the translation file and highlight its value (supports nested keys)
     * @param {vscode.TextEditor} editor The text editor
     * @param {string} key The key to find (can be nested like "login.inputs.email")
     * @returns {Promise<void>}
     */
    async navigateToKey(editor, key) {
        try {
            const document = editor.document;
            
            // Get workspace folder to determine locale from file path
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('Cannot determine workspace folder');
                return;
            }

            const workspacePath = workspaceFolder.uri.fsPath;
            const filePath = document.uri.fsPath;
            
            // Determine locale from file path
            const path = require('path');
            const fileName = path.basename(filePath, '.json');
            const locale = fileName; // Assuming file name is the locale
            
            // Use existing TranslationService to load and process the translation
            const translations = await this.translationService.loadTranslationsForLocale(workspacePath, locale);
            if (!translations) {
                vscode.window.showWarningMessage(`Could not load translations for locale: ${locale}`);
                return;
            }
            
            // Use existing getTranslation method to get the processed value (handles both simple and complex)
            const translationValue = this.translationService.getTranslation(translations, key);
            if (!translationValue) {
                vscode.window.showWarningMessage(`Key "${key}" not found in translation file`);
                return;
            }
            
            // Remove the asterisk if present (added by complex structure processing)
            const searchValue = translationValue.endsWith('*') ? 
                translationValue.slice(0, -1) : translationValue;
            
            // Try to navigate to the value first
            if (await this.navigateToValue(editor, searchValue)) {
                console.log(`🎯 Navigated to key "${key}" (value: "${searchValue}") in ${document.fileName}`);
                return;
            }
            
            // Fallback: navigate to the key itself
            if (await this.navigateToKeyName(editor, key)) {
                console.log(`🎯 Navigated to key "${key}" (key location) in ${document.fileName}`);
                return;
            }
            
            vscode.window.showWarningMessage(`Key "${key}" not found in translation file`);

        } catch (error) {
            console.error('Error navigating to key:', error);
            vscode.window.showErrorMessage(`Failed to navigate to key: ${error.message}`);
        }
    }

    /**
     * Navigate to a translation value in the file
     * @param {vscode.TextEditor} editor The text editor
     * @param {string} value The value to find
     * @returns {Promise<boolean>} True if navigation was successful
     */
    async navigateToValue(editor, value) {
        try {
            const document = editor.document;
            const text = document.getText();
            
            const valueRegex = new RegExp(`"${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g');
            const match = valueRegex.exec(text);
            
            if (match) {
                // Highlight the value (without quotes)
                const valueStart = match.index + 1; // Skip opening quote
                const valueEnd = valueStart + value.length;
                
                const startPos = document.positionAt(valueStart);
                const endPos = document.positionAt(valueEnd);
                
                const selection = new vscode.Selection(startPos, endPos);
                editor.selection = selection;
                editor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error navigating to value:', error);
            return false;
        }
    }

    /**
     * Navigate to a translation key in the file (supports nested keys)
     * @param {vscode.TextEditor} editor The text editor
     * @param {string} key The key to find (can be nested like "login.inputs.email")
     * @returns {Promise<boolean>} True if navigation was successful
     */
    async navigateToKeyName(editor, key) {
        try {
            const document = editor.document;
            const text = document.getText();
            
            if (key.includes('.')) {
                // Nested key - search for the final key name
                const keyParts = key.split('.');
                const finalKey = keyParts[keyParts.length - 1];
                
                // Create a regex pattern that matches the nested structure
                // This is more complex, so we'll use a simpler approach: search for the final key
                const keyRegex = new RegExp(`"${finalKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:`, 'g');
                
                let match;
                const matches = [];
                
                // Find all matches and look for the one in the right context
                while ((match = keyRegex.exec(text)) !== null) {
                    matches.push(match);
                }
                
                // For nested keys, try to find the correct match by checking context
                for (const match of matches) {
                    // Simple heuristic: check if we're in the right nested context
                    const beforeText = text.substring(Math.max(0, match.index - 200), match.index);
                    const containsParentKeys = keyParts.slice(0, -1).every(parentKey => 
                        beforeText.includes(`"${parentKey}"`)
                    );
                    
                    if (containsParentKeys || matches.length === 1) {
                        const keyStart = match.index + 1; // Skip opening quote
                        const keyEnd = keyStart + finalKey.length;
                        
                        const startPos = document.positionAt(keyStart);
                        const endPos = document.positionAt(keyEnd);
                        
                        const selection = new vscode.Selection(startPos, endPos);
                        editor.selection = selection;
                        editor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
                        
                        return true;
                    }
                }
                
                // If no good context match, use first match
                if (matches.length > 0) {
                    const match = matches[0];
                    const keyStart = match.index + 1; // Skip opening quote
                    const keyEnd = keyStart + finalKey.length;
                    
                    const startPos = document.positionAt(keyStart);
                    const endPos = document.positionAt(keyEnd);
                    
                    const selection = new vscode.Selection(startPos, endPos);
                    editor.selection = selection;
                    editor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
                    
                    return true;
                }
            } else {
                // Flat key - simple search
                const keyRegex = new RegExp(`"${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g');
                const keyMatch = keyRegex.exec(text);
                
                if (keyMatch) {
                    const startPos = document.positionAt(keyMatch.index);
                    const endPos = document.positionAt(keyMatch.index + keyMatch[0].length);
                    
                    const selection = new vscode.Selection(startPos, endPos);
                    editor.selection = selection;
                    editor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
                    
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.error('Error navigating to key name:', error);
            return false;
        }
    }

    /**
     * Check if a document is a translation file
     * @param {vscode.TextDocument} document The document to check
     * @returns {Promise<boolean>} True if this is a translation file
     */
    async isTranslationFile(document) {
        try {
            if (!document) {
                return false;
            }
            
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
            if (!workspaceFolder) {
                return false;
            }

            const workspacePath = workspaceFolder.uri.fsPath;
            const filePath = document.uri.fsPath;
            
            // Get the path pattern for translation files
            const pathPattern = this.localeService.getTranslationPathPattern(workspacePath);
            
            const path = require('path');
            const relativePath = path.relative(workspacePath, filePath);
            
            // Normalize paths for comparison (handle Windows paths)
            const normalizedRelativePath = relativePath.replace(/\\/g, '/');
            
            // Use the actual available locales from configuration instead of hardcoding
            const availableLocales = await this.getAvailableLocales(workspacePath);
            
            for (const locale of availableLocales) {
                let expectedPath = pathPattern.replace('{locale}', locale);
                
                // Handle different path formats
                if (expectedPath.startsWith('./')) {
                    expectedPath = expectedPath.substring(2);
                }
                
                // Normalize expected path
                expectedPath = expectedPath.replace(/\\/g, '/');
                
                if (normalizedRelativePath === expectedPath) {
                    return true;
                }
            }
            
            return false;
            
        } catch (error) {
            console.error('Error checking if file is translation file:', error);
            return false;
        }
    }
}

module.exports = { SidebarService }; 