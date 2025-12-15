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
        this.options = { 
            method: 'GET',
            timeout: 30000, // 30 second timeout
            maxRetries: process.env.NODE_ENV === 'test' ? 0 : 2, // Disable retries in test environment
            retryDelay: 500, // 500ms between retries
            headers: {
                'Connection': 'close' // Prevent keep-alive issues
            }
        };
    }

    /**
     * Performs a GET request to the configured API URL with retry logic
     * 
     * @param {URLSearchParams} requestData - Query parameters for the request
     * @param {Function} callback - Callback function(data) invoked with response data
     * @param {number} attempt - Current retry attempt (internal use)
     */
    get(requestData, callback, attempt = 0) {
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
                // Retry on DNS failures (EAI_AGAIN) or connection resets
                const isRetryableError = e.code === 'EAI_AGAIN' || 
                                        e.code === 'ECONNRESET' || 
                                        e.code === 'ENOTFOUND' ||
                                        e.code === 'ETIMEDOUT';
                
                // Only retry if not already retrying and retries are enabled
                const shouldRetry = isRetryableError && 
                                   attempt < this.options.maxRetries && 
                                   !callbackInvoked;
                
                if (shouldRetry) {
                    this.logger.info(`${this.apiUrl} : Retrying after ${e.message} (attempt ${attempt + 1}/${this.options.maxRetries + 1})`);
                    setTimeout(() => {
                        this.get(requestData, callback, attempt + 1);
                    }, this.options.retryDelay * (attempt + 1)); // Exponential backoff
                } else {
                    this.logger.error(`${this.apiUrl} : Request error: ${e.message}`);
                    safeCallback(this.defaultApiReply);
                }
            });

            apiReq.on('timeout', () => {
                this.logger.error(`${this.apiUrl} : Timeout (${this.options.timeout}ms)`);
                apiReq.destroy();
                safeCallback(this.defaultApiReply);
            });

            // Set the timeout on the request
            if (this.options.timeout) {
                apiReq.setTimeout(this.options.timeout);
            }

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