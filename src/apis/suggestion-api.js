const https = require('https');
const http = require('http');
const logger = require('../logger');
const config = require('config');

/**
 * SuggestionApiRequest - Standalone HTTP client for query suggestion API with HTML parsing
 * 
 * This class is standalone (does not extend ApiRequest) because it requires special
 * HTML response parsing to extract query suggestions from specific div elements.
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
 */
class SuggestionApiRequest {
    constructor() {
        this.apiUrl = config.get('query.suggestion.api');
        this.defaultApiParams = {
            query: '',
            l: 'pt',
        };
        this.defaultApiReply = '';
        this.logger = logger('SuggestionApiRequest');
        // Short timeout - suggestions are not critical, service is sometimes down
        this.options = { method: 'GET', timeout: 1000 };
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
     * Performs a GET request with HTML parsing
     * 
     * Extracts suggestion from HTML response using regex to find:
     * <div id="correction"><em>SUGGESTION_TEXT</em></div>
     * 
     * Falls back to original query if no suggestion is found.
     * 
     * @param {URLSearchParams} requestData - Query parameters
     * @param {Function} callback - Callback function(suggestion) with suggestion string
     */
    get(requestData, callback) {
        // Local variables for memory safety
        let apiReply = '';
        let callbackInvoked = false;
        const originalQuery = requestData.get('query') || '';

        const safeCallback = (data) => {
            if (!callbackInvoked) {
                callbackInvoked = true;
                callback(data);
            }
        };

        const request = this.apiUrl.startsWith('https') ? https.request : http.request;

        try {
            const url = this.apiUrl + '?' + this.sanitizeRequestData(requestData).toString();
            this.logger.info(url);

            const apiReq = request(url, this.options, (apiRes) => {
                // Handle non-2xx status codes - return original query
                if (apiRes.statusCode < 200 || apiRes.statusCode >= 300) {
                    this.logger.error(`${this.apiUrl} : Invalid status code: ${apiRes.statusCode}`);
                    safeCallback(originalQuery);
                    return;
                }

                // Accumulate HTML response, strip newlines
                apiRes.on('data', (chunk) => {
                    apiReply += chunk.toString().split("\n").join('');
                });

                // Parse complete HTML response
                apiRes.on('end', () => {
                    // Extract suggestion from HTML: <div id="correction"><em>SUGGESTION</em></div>
                    const suggestionRegex = /<div\s+id=['"]correction['"]><em>(.*)<\/em><\/div>/;
                    if (suggestionRegex.test(apiReply)) {
                        const suggestion = apiReply.match(suggestionRegex)[1];
                        safeCallback(suggestion);
                    } else {
                        // No suggestion found, return original query
                        safeCallback(originalQuery);
                    }
                });

                // Handle response errors - return original query
                apiRes.on('error', (e) => {
                    this.logger.error(`${this.apiUrl} : Response error: ${e.message}`);
                    safeCallback(originalQuery);
                });
            });

            // Handle request errors - return original query
            apiReq.on('error', (e) => {
                this.logger.error(`${this.apiUrl} : Request error: ${e.message}`);
                safeCallback(originalQuery);
            });

            // Handle timeout - return original query
            apiReq.on('timeout', () => {
                this.logger.error(`${this.apiUrl} : Timeout (${this.options.timeout} ms)`);
                apiReq.destroy();
                safeCallback(originalQuery);
            });

            // Configure timeout
            if (this.options.timeout) {
                apiReq.setTimeout(this.options.timeout);
            }

            apiReq.end();

        } catch (e) {
            this.logger.error(`${this.apiUrl} : Exception: ${e.message}`);
            safeCallback(originalQuery);
        }
    }

    /**
     * Sanitizes and merges request parameters with defaults
     * 
     * @param {URLSearchParams} requestData - Request-specific parameters
     * @returns {URLSearchParams} Sanitized and merged parameters
     */
    sanitizeRequestData(requestData) {
        const apiRequestData = new URLSearchParams();
        
        // Merge defaultApiParams with requestData
        Object.keys(this.defaultApiParams)
            .filter(key => this.defaultApiParams[key] !== null || requestData.has(key))
            .forEach(key => apiRequestData.set(key, requestData.get(key) ?? this.defaultApiParams[key]));
            
        return apiRequestData;
    }
}

module.exports = SuggestionApiRequest;