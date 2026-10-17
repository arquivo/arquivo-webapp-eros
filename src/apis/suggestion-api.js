const BaseApiRequest = require('./base-api-request');
const config = require('config');

/**
 * SuggestionApiRequest - HTTP client for query suggestion API with HTML parsing
 * 
 * Extends BaseApiRequest with special HTML response parsing to extract
 * query suggestions from specific div elements.
 * 
 * Features:
 * - HTML parsing to extract suggestions from <div id="correction"><em>...</em></div>
 * - Graceful fallback to original query if no suggestion found
 * - Short timeout (1000ms) since suggestions are not critical
 * - Can be disabled via configuration
 * - Memory-safe (uses local variables per request)
 * - Safe callback invocation (prevents multiple calls)
 * 
 * @class
 * @extends BaseApiRequest
 */
class SuggestionApiRequest extends BaseApiRequest {
    constructor() {
        const apiUrl = config.get('query.suggestion.api');
        const defaultApiParams = {
            query: '',
            l: 'pt',
        };
        const defaultApiReply = '';
        // Short timeout - suggestions are not critical, service is sometimes down
        const options = { method: 'GET', timeout: 1000 };
        
        super(apiUrl, defaultApiParams, defaultApiReply, 'SuggestionApiRequest', options);
        
        this.enabled = config.has('query.suggestion.api_enabled') && 
                      config.get('query.suggestion.api_enabled') === true;
    }

    /**
     * Gets query suggestion for the given query and language
     * 
     * If enabled, makes HTTP request and parses HTML response.
     * If disabled, returns original query asynchronously.
     * 
     * @param {string} query - Search query to get suggestion for
     * @param {string} lang - Language code (e.g., 'pt', 'en')
     * @param {Function} callback - Callback function(suggestion) with suggestion string
     */
    getSuggestion(query, lang, callback) {
        if (this.enabled) {
            const requestData = new URLSearchParams({
                query: query,
                l: lang,
            });
            this.get(requestData, callback);
        } else {
            // Return original query asynchronously when disabled
            process.nextTick(() => {
                callback(query);
            });
        }
    }

    /**
     * On errors, reply with the original query (no suggestion) instead of defaultApiReply
     *
     * @param {URLSearchParams} requestData - Original request parameters
     * @returns {string} The original query, or '' if there is none
     */
    fallbackReply(requestData) {
        return requestData.get('query') || '';
    }

    /**
     * Process HTTP response with HTML parsing
     * 
     * Extracts suggestion from HTML response using regex to find:
     * <div id="correction"><em>SUGGESTION_TEXT</em></div>
     * 
     * Falls back to original query if no suggestion is found.
     * 
     * @param {http.IncomingMessage} apiRes - HTTP response object
     * @param {Function} safeCallback - Safe callback to invoke with suggestion
     * @param {URLSearchParams} requestData - Original request parameters (for fallback)
     */
    processResponse(apiRes, safeCallback, requestData) {
        let apiReply = '';
        const originalQuery = this.fallbackReply(requestData);

        // Accumulate HTML response, strip newlines
        apiRes.on('data', (chunk) => {
            apiReply += chunk.replaceAll('\n', '');
        });

        // Parse complete HTML response
        apiRes.on('end', () => {
            // Extract suggestion from HTML: <div id="correction"><em>SUGGESTION</em></div>
            const suggestionRegex = /<div\s+id=['"]correction['"]><em>(.*)<\/em><\/div>/;
            const match = suggestionRegex.exec(apiReply);
            if (match) {
                const suggestion = match[1];
                safeCallback(suggestion);
            } else {
                // No suggestion found, return original query
                safeCallback(originalQuery);
            }
        });
    }
}

module.exports = SuggestionApiRequest;
