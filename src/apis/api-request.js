const https = require('node:https');
const http = require('node:http');
const logger = require('../logger');

/**
 * ApiRequest - Simple HTTP client for making API requests with JSON response parsing
 * 
 * This is a standalone class (does not extend BaseApiRequest) because it's simple enough
 * to not require the overhead of inheritance. It provides straightforward JSON API calls.
 * 
 * Features:
 * - Automatic HTTPS/HTTP protocol detection
 * - Memory leak prevention (no state accumulation between requests)
 * - Safe callback invocation (prevents multiple callback calls)
 * - Comprehensive error handling and logging
 * - Request parameter sanitization
 * - JSON response parsing
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
     * @param {URLSearchParams} requestData - Query parameters for the request
     * @param {Function} callback - Callback function(data) invoked with response data
     */
    get(requestData, callback) {
        let apiReply = '';
        let callbackInvoked = false;

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
                if (apiRes.statusCode < 200 || apiRes.statusCode >= 300) {
                    this.logger.error(`${this.apiUrl} : Invalid status code: ${apiRes.statusCode}`);
                    safeCallback(this.defaultApiReply);
                    return;
                }

                apiRes.on('data', (chunk) => {
                    apiReply += chunk.toString();
                });

                apiRes.on('end', () => {
                    try {
                        const apiData = JSON.parse(apiReply);
                        safeCallback(apiData);
                    } catch (e) {
                        this.logger.error(`${this.apiUrl} : JSON parse error: ${e.message}`);
                        safeCallback(this.defaultApiReply);
                    }
                });

                apiRes.on('error', (e) => {
                    this.logger.error(`${this.apiUrl} : Response error: ${e.message}`);
                    safeCallback(this.defaultApiReply);
                });
            });

            apiReq.on('error', (e) => {
                this.logger.error(`${this.apiUrl} : Request error: ${e.message}`);
                safeCallback(this.defaultApiReply);
            });

            apiReq.on('timeout', () => {
                this.logger.error(`${this.apiUrl} : Timeout (${this.options.timeout || 120000} ms)`);
                apiReq.destroy();
                safeCallback(this.defaultApiReply);
            });

            apiReq.end();

        } catch (e) {
            this.logger.error(`${this.apiUrl} : Exception: ${e.message}`);
            safeCallback(this.defaultApiReply);
        }
    }

    /**
     * Sanitizes and merges request parameters with default parameters
     * 
     * @param {URLSearchParams} requestData - Request-specific parameters
     * @returns {URLSearchParams} Sanitized and merged parameters
     */
    sanitizeRequestData(requestData) {
        const apiRequestData = new URLSearchParams();

        Object.keys(this.defaultApiParams)
            .filter(key => this.defaultApiParams[key] !== null || requestData.has(key))
            .forEach(key => apiRequestData.set(key, requestData.get(key) ?? this.defaultApiParams[key]));
            
        return apiRequestData;
    }
}

module.exports = ApiRequest