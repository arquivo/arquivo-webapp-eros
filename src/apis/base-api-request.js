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
 * This is the single place for the request flow (status check, request errors, timeout);
 * subclasses only parse the response. JSON APIs extend JsonApiRequest.
 *
 * Subclasses must implement:
 * - processResponse(apiRes, safeCallback, requestData) - Process the HTTP response
 *
 * Subclasses may override:
 * - fallbackReply(requestData) - What to reply on errors (defaults to defaultApiReply)
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
            timeout: 180000 // 3 minutes
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
     */
    get(requestData, callback) {
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
                    safeCallback(this.fallbackReply(requestData));
                    return;
                }

                // Delegate response processing to subclass
                this.processResponse(apiRes, safeCallback, requestData);
            });

            // Handle request errors
            apiReq.on('error', (e) => {
                this.logger.error(`${this.apiUrl} : Request error: ${e.message}`);
                if (!apiReq.destroyed) {
                    apiReq.destroy();
                }
                safeCallback(this.fallbackReply(requestData));
            });

            // Handle timeout
            apiReq.on('timeout', () => {
                this.logger.error(`${this.apiUrl} : Timeout (${this.options.timeout}ms)`);
                apiReq.destroy();
                safeCallback(this.fallbackReply(requestData));
            });

            // Configure timeout if specified
            if (this.options.timeout) {
                apiReq.setTimeout(this.options.timeout);
            }

            apiReq.end();

        } catch (e) {
            this.logger.error(`${this.apiUrl} : Exception: ${e.message}`);
            safeCallback(this.fallbackReply(requestData));
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
     * Reply passed to the callback when the request fails (non-2xx status, request
     * or response error, timeout, exception)
     *
     * @param {URLSearchParams} requestData - Original request parameters (for context)
     * @returns {*} The default reply
     */
    fallbackReply(requestData) {
        return this.defaultApiReply;
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
