const fs = require('fs');
const path = require('path');

/**
 * Repository for loading translation data from files
 */
class TranslationRepository {
    /**
     * Load translations for the specified locale
     * @param {string} translationFilePath The full path to the translation file
     * @param {string} locale The locale for logging purposes
     * @returns {Promise<Object|null>} The translations object or null if not found
     */
    async loadTranslations(translationFilePath, locale) {
        try {
            console.log(`📖 Reading translations from: ${path.basename(translationFilePath)} (locale: ${locale})`);
            
            if (!fs.existsSync(translationFilePath)) {
                console.log(`❌ Translation file not found: ${translationFilePath}`);
                return null;
            }

            const fileContent = fs.readFileSync(translationFilePath, 'utf8');
            const translations = JSON.parse(fileContent);
            
            console.log(`✅ Loaded ${Object.keys(translations).length} translations for locale '${locale}'`);
            
            return translations;
        } catch (error) {
            console.log(`❌ Failed to load translations: ${error.message}`);
            return null;
        }
    }

    /**
     * Check if a translation file exists
     * @param {string} translationFilePath The full path to the translation file
     * @returns {boolean} True if the file exists
     */
    translationFileExists(translationFilePath) {
        return fs.existsSync(translationFilePath);
    }
}

module.exports = { TranslationRepository }; 