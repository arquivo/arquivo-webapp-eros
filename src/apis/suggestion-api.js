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
     * Performs a GET request with HTML parsing
     * Overrides parent to return original query on errors instead of defaultApiReply
     * 
     * @param {URLSearchParams} requestData - Query parameters
     * @param {Function} callback - Callback function(suggestion) with suggestion string
     */
    get(requestData, callback) {
        // Validate callback
        if (typeof callback !== 'function') {
            return;
        }

        const originalQuery = requestData.get('query') || '';
        const { safeCallback } = this.createSafeCallback((result) => {
            callback(result);
        });
        
        const https = require('https');
        const http = require('http');
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

                // Delegate response processing to processResponse
                this.processResponse(apiRes, safeCallback, requestData);
            });

            // Handle request errors - return original query
            apiReq.on('error', (e) => {
                this.logger.error(`${this.apiUrl} : Request error: ${e.message}`);
                if (!apiReq.destroyed) {
                    apiReq.destroy();
                }
                safeCallback(originalQuery);
            });

            // Handle timeout - return original query
            apiReq.on('timeout', () => {
                this.logger.error(`${this.apiUrl} : Timeout (${this.options.timeout} ms)`);
                apiReq.destroy();
                safeCallback(originalQuery);
            });

            // Configure timeout if specified
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
        const originalQuery = requestData.get('query') || '';

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
    }
}

module.exports = SuggestionApiRequest;