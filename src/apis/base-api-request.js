const https = require('node:https');
const http = require('node:http');
const logger = require('../logger');

/**
 * BaseApiRequest - Abstract base class for HTTP API clients
 * 
 * Provides common functionality for API request classes that need custom response processing:
 * - Safe callback invocation (prevents multiple calls)
 * - Protocol detection (HTTPS/HTTP)
 * - Error handling and logging
 * - Request parameter sanitization
 * - Memory leak prevention
 * 
 * Subclasses must implement:
 * - processResponse(apiRes, safeCallback, requestData) - Process the HTTP response
 * 
 * @abstract
 * @class
 */
class BaseApiRequest {
    /**
     * Creates a BaseApiRequest instance
     * 
     * @param {string} apiUrl - The base URL for API requests
     * @param {Object} defaultApiParams - Default parameters for all requests
     * @param {*} defaultApiReply - Fallback response returned on errors
     * @param {string} loggerName - Logger name for this API client
     * @param {Object} options - HTTP request options (method, timeout, etc.)
     */
    constructor(apiUrl, defaultApiParams = {}, defaultApiReply = {}, loggerName = 'BaseApiRequest', options = null) {
        this.apiUrl = apiUrl;
        this.defaultApiParams = defaultApiParams;
        this.defaultApiReply = defaultApiReply;
        this.logger = logger(loggerName);
        this.options = options || { 
            method: 'GET',
            timeout: 30000,
            maxRetries: process.env.NODE_ENV === 'test' ? 0 : 2,
            retryDelay: 500
        };
    }

    /**
     * Creates a safe callback wrapper that ensures callback is only called once
     * 
     * @param {Function} callback - Original callback function
     * @returns {Object} Object with safeCallback function and callbackInvoked flag
     */
    createSafeCallback(callback) {
        let callbackInvoked = false;
        
        const safeCallback = (data) => {
            if (!callbackInvoked && typeof callback === 'function') {
                callbackInvoked = true;
                callback(data);
            }
        };

        return { safeCallback, callbackInvoked: () => callbackInvoked };
    }

    /**
     * Performs a GET request to the configured API URL
     * 
     * Handles all common error cases and delegates response processing to subclass.
     * 
     * @param {URLSearchParams} requestData - Query parameters for the request
     * @param {Function} callback - Callback function invoked with response data
     * @param {number} attempt - Current retry attempt (internal use)
     */
    get(requestData, callback, attempt = 0) {
        // Validate callback
        if (typeof callback !== 'function') {
            return;
        }

        const { safeCallback } = this.createSafeCallback(callback);
        const request = this.apiUrl.startsWith('https') ? https.request : http.request;

        try {
            const url = this.apiUrl + '?' + this.sanitizeRequestData(requestData).toString();
            this.logger.info(url);

            const apiReq = request(url, this.options, (apiRes) => {
                // Handle non-2xx status codes
                if (apiRes.statusCode < 200 || apiRes.statusCode >= 300) {
                    this.logger.error(`${this.apiUrl} : Invalid status code: ${apiRes.statusCode}`);
                    safeCallback(this.defaultApiReply);
                    return;
                }

                // Delegate response processing to subclass
                this.processResponse(apiRes, safeCallback, requestData);
            });

            // Handle request errors
            apiReq.on('error', (e) => {
                // Retry on DNS failures (EAI_AGAIN) or connection resets
                const isRetryableError = e.code === 'EAI_AGAIN' || 
                                        e.code === 'ECONNRESET' || 
                                        e.code === 'ENOTFOUND' ||
                                        e.code === 'ETIMEDOUT';
                
                // Only retry if we haven't exceeded max retries
                const shouldRetry = isRetryableError && attempt < this.options.maxRetries;
                
                if (shouldRetry) {
                    this.logger.info(`${this.apiUrl} : Retrying after ${e.message} (attempt ${attempt + 1}/${this.options.maxRetries + 1})`);
                    if (!apiReq.destroyed) {
                        apiReq.destroy();
                    }
                    setTimeout(() => {
                        this.get(requestData, callback, attempt + 1);
                    }, this.options.retryDelay * (attempt + 1)); // Exponential backoff
                } else {
                    this.logger.error(`${this.apiUrl} : Request error: ${e.message}`);
                    if (!apiReq.destroyed) {
                        apiReq.destroy();
                    }
                    safeCallback(this.defaultApiReply);
                }
            });

            // Handle timeout
            apiReq.on('timeout', () => {
                this.logger.error(`${this.apiUrl} : Timeout (${this.options.timeout || 120000} ms)`);
                apiReq.destroy();
                safeCallback(this.defaultApiReply);
            });

            // Configure timeout if specified
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
     * Process HTTP response - must be implemented by subclass
     * 
     * @abstract
     * @param {http.IncomingMessage} apiRes - HTTP response object
     * @param {Function} safeCallback - Safe callback to invoke with result
     * @param {URLSearchParams} requestData - Original request parameters (for context)
     */
    processResponse(apiRes, safeCallback, requestData) {
        throw new Error('processResponse() must be implemented by subclass');
    }

    /**
     * Sanitizes and merges request parameters with default parameters
     * 
     * Priority: requestData > defaultApiParams
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

module.exports = BaseApiRequest;
