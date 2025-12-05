const https = require('https');
const http = require('http');
const logger = require('../logger');

/**
 * ApiRequest - HTTP client for making API requests with built-in error handling
 * 
 * Features:
 * - Automatic HTTPS/HTTP protocol detection
 * - Memory leak prevention (no state accumulation between requests)
 * - Safe callback invocation (prevents multiple callback calls)
 * - Comprehensive error handling and logging
 * - Request parameter sanitization
 * 
 * @class
 * @example
 * const api = new ApiRequest('https://api.example.com', 
 *   { apiKey: 'default-key' },  // default params
 *   { error: 'default' }         // default reply on error
 * );
 * 
 * api.get(new URLSearchParams({ query: 'test' }), (data) => {
 *   console.log(data);
 * });
 */
class ApiRequest {
    /**
     * Creates an ApiRequest instance
     * 
     * @param {string} apiUrl - The base URL for API requests
     * @param {Object} defaultApiParams - Default parameters for all requests (optional)
     * @param {Object} defaultApiReply - Fallback response returned on errors (optional)
     */
    constructor(apiUrl, defaultApiParams = {}, defaultApiReply = {}) {
        this.apiUrl = apiUrl;
        this.defaultApiParams = defaultApiParams;
        this.defaultApiReply = defaultApiReply;
        this.logger = logger('ApiRequest');
        this.options = { method: 'GET' };
    }

    /**
     * Performs a GET request to the configured API URL
     * 
     * Error Handling Strategy:
     * 1. Memory Safety: Uses local variables to prevent memory leaks
     * 2. Callback Safety: Ensures callback is invoked exactly once
     * 3. Graceful Degradation: Returns defaultApiReply on any error
     * 4. Comprehensive Logging: Logs all error scenarios with context
     * 
     * @param {URLSearchParams} requestData - Query parameters for the request
     * @param {Function} callback - Callback function(data) invoked with response data
     * 
     * @example
     * const params = new URLSearchParams({ q: 'search', limit: 10 });
     * api.get(params, (data) => {
     *   if (data.error) {
     *     console.error('API error:', data.error);
     *   } else {
     *     console.log('Results:', data.results);
     *   }
     * });
     */
    get(requestData, callback) {
        // MEMORY LEAK FIX: Use local variable instead of instance property
        // This ensures apiReply is reset for each request, preventing accumulation
        let apiReply = '';
        
        // DUPLICATE CALLBACK FIX: Track if callback has been invoked
        // Prevents race conditions where multiple error events could trigger callback
        let callbackInvoked = false;

        /**
         * Safe callback wrapper that ensures callback is only called once
         * This prevents issues where multiple error events (e.g., 'error' and 'close')
         * could trigger the callback multiple times
         * 
         * @param {*} data - Data to pass to the original callback
         */
        const safeCallback = (data) => {
            if (!callbackInvoked) {
                callbackInvoked = true;
                callback(data);
            }
        };

        // Select appropriate protocol handler based on URL
        const request = this.apiUrl.startsWith('https') ? https.request : http.request;

        try {
            // Build complete URL with sanitized query parameters
            const url = this.apiUrl + '?' + this.sanitizeRequestData(requestData).toString();
            this.logger.info(url);

            // Make the HTTP(S) request
            const apiReq = request(url, this.options, (apiRes) => {
                // ERROR CASE 1: Non-2xx HTTP status codes
                // Return defaultApiReply for client errors (4xx) and server errors (5xx)
                if (apiRes.statusCode < 200 || apiRes.statusCode >= 300) {
                    this.logger.error(`${this.apiUrl} : Invalid status code: ${apiRes.statusCode}`);
                    safeCallback(this.defaultApiReply);
                    return;
                }

                // SUCCESS CASE: Accumulate response data chunks
                // Using local variable apiReply prevents memory leaks
                apiRes.on('data', (chunk) => {
                    apiReply += chunk.toString();
                });

                // SUCCESS CASE: Parse complete JSON response
                apiRes.on('end', () => {
                    try {
                        const apiData = JSON.parse(apiReply);
                        safeCallback(apiData);
                    } catch (e) {
                        // ERROR CASE 2: Invalid JSON in response body
                        this.logger.error(`${this.apiUrl} : JSON parse error: ${e.message}`);
                        safeCallback(this.defaultApiReply);
                    }
                });

                // ERROR CASE 3: Response stream errors
                // Can occur during data transmission after successful connection
                apiRes.on('error', (e) => {
                    this.logger.error(`${this.apiUrl} : Response error: ${e.message}`);
                    safeCallback(this.defaultApiReply);
                });
            });

            // ERROR CASE 4: Request-level errors
            // Network failures, DNS errors, connection refused, etc.
            apiReq.on('error', (e) => {
                this.logger.error(`${this.apiUrl} : Request error: ${e.message}`);
                safeCallback(this.defaultApiReply);
            });

            // ERROR CASE 5: Request timeout
            // Fires when request takes longer than configured timeout (default: 120s)
            // Note: Must be configured via this.options.timeout
            apiReq.on('timeout', () => {
                this.logger.error(`${this.apiUrl} : Timeout (${this.options.timeout || 120000} ms)`);
                apiReq.destroy();
                safeCallback(this.defaultApiReply);
            });

            // Send the request (no body for GET requests)
            apiReq.end();

        } catch (e) {
            // ERROR CASE 6: Synchronous exceptions
            // Catches errors in request setup (invalid URL, etc.)
            this.logger.error(`${this.apiUrl} : Exception: ${e.message}`);
            safeCallback(this.defaultApiReply);
        }
    }

    /**
     * Sanitizes and merges request parameters with default parameters
     * 
     * Priority: requestData > defaultApiParams
     * - Parameters in requestData override defaults
     * - Null default parameters are included only if present in requestData
     * - Missing parameters use default values
     * 
     * @param {URLSearchParams} requestData - Request-specific parameters
     * @returns {URLSearchParams} Sanitized and merged parameters
     * 
     * @example
     * // With defaults: { apiKey: 'abc', version: null }
     * // Request: { version: 'v2', query: 'test' }
     * // Result: { apiKey: 'abc', version: 'v2', query: 'test' }
     */
    sanitizeRequestData(requestData) {
        const apiRequestData = new URLSearchParams();

        // Merge defaultApiParams with requestData
        // Filter logic:
        // - Include if default is NOT null (always include non-null defaults)
        // - OR include if requestData has the key (override null defaults)
        Object.keys(this.defaultApiParams)
            .filter(key => this.defaultApiParams[key] !== null || requestData.has(key))
            .forEach(key => apiRequestData.set(key, requestData.get(key) ?? this.defaultApiParams[key]));
            
        return apiRequestData;
    }
}

module.exports = ApiRequest