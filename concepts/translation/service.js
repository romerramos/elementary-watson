const { TranslationRepository } = require('./repository');
const { LocaleService } = require('../locale/service');

/**
 * Service for processing translation calls and coordinating translation loading
 */
class TranslationService {
    constructor() {
        this.translationRepository = new TranslationRepository();
        this.localeService = new LocaleService();
    }

    /**
     * Find all m.methodName() calls in text
     * @param {string} text The source code text to analyze
     * @returns {Array} Array of translation call objects
     */
    findTranslationCalls(text) {
        const calls = [];
        // Pattern to match m.methodName() or m.methodName(params)
        const pattern = /\bm\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(\s*([^)]*)\s*\)/g;
        
        let match;
        while ((match = pattern.exec(text)) !== null) {
            calls.push({
                methodName: match[1],
                params: match[2].trim(),
                start: match.index,
                end: match.index + match[0].length
            });
        }
        
        return calls;
    }

    /**
     * Load translations for a workspace and locale
     * @param {string} workspacePath The workspace root path
     * @param {string} locale The locale to load translations for
     * @returns {Promise<Object|null>} The translations object or null if not found
     */
    async loadTranslationsForLocale(workspacePath, locale) {
        const translationPath = this.localeService.resolveTranslationPath(workspacePath, locale);
        return await this.translationRepository.loadTranslations(translationPath, locale);
    }

    /**
     * Process paraglide variant array to extract display value
     * @param {Array} variantArray The paraglide variant array
     * @returns {string|null} The first match value from the variant or null if invalid
     */
    processParaglideVariant(variantArray) {
        try {
            // Get the first element of the array
            if (!Array.isArray(variantArray) || variantArray.length === 0) {
                return null;
            }

            const firstVariant = variantArray[0];
            
            // Check if it has the expected structure with a match property
            if (!firstVariant || typeof firstVariant !== 'object' || !firstVariant.match) {
                return null;
            }

            // Get the first value from the match object
            const matchValues = Object.values(firstVariant.match);
            if (matchValues.length === 0) {
                return null;
            }

            // Return the first match value
            return matchValues[0];
        } catch (error) {
            console.error('Error processing paraglide variant:', error);
            return null;
        }
    }

    /**
     * Get translation value for a specific key
     * @param {Object} translations The translations object
     * @param {string} key The translation key
     * @returns {string|null} The translation value or null if not found
     */
    getTranslation(translations, key) {
        if (!translations || !translations[key]) {
            return null;
        }

        const value = translations[key];

        // Case 1: Simple string value - return as-is
        if (typeof value === 'string') {
            return value;
        }

        // Case 2: Paraglide variant array - process and add asterisk
        if (Array.isArray(value)) {
            const variantValue = this.processParaglideVariant(value);
            if (variantValue) {
                return `${variantValue}*`;
            }
        }

        // Case 3: Unsupported format
        return null;
    }

    /**
     * Process translation calls and return their resolved values
     * @param {Array} translationCalls Array of translation call objects
     * @param {Object} translations The translations object
     * @returns {Array} Array of objects with call info and translation values
     */
    processTranslationCalls(translationCalls, translations) {
        const results = [];
        
        for (const call of translationCalls) {
            const translationValue = this.getTranslation(translations, call.methodName);
            if (translationValue) {
                results.push({
                    ...call,
                    translationValue
                });
            }
        }
        
        return results;
    }
}

module.exports = { TranslationService }; 