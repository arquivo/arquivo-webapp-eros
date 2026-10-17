'use strict';

const https = require('node:https');
const http = require('node:http');
const logger = require('../logger');

// Default cap on the size of a response body. Far above what the search APIs reply: about 0.7 MB
// at most, even when asked for their maximum number of items.
const DEFAULT_MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

// Default total deadline, also used when options.timeout is missing or 0, so no request is ever
// left without one (the agent's socket timeout does not stop a backend that keeps sending data)
const DEFAULT_TIMEOUT_MS = 180000; // 3 minutes

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
 * This is the single place for the request flow (status check, request and response errors,
 * timeouts, response size cap, UTF-8 body decoding); subclasses only parse the response.
 * JSON APIs extend JsonApiRequest.
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
     * @param {Object} options - HTTP request options (method, agent, etc.), plus:
     *   - timeout: total deadline in ms for the whole request, body included (AbortSignal.timeout);
     *     3 minutes when missing or 0
     *   - idleTimeout: optional, give up when the backend sends nothing for this many ms
     *   - maxResponseBytes: optional, give up on a body larger than this (defaults to 10 MB)
     */
    constructor(apiUrl, defaultApiParams = {}, defaultApiReply = {}, loggerName = 'BaseApiRequest', options = null) {
        this.apiUrl = apiUrl;
        this.defaultApiParams = defaultApiParams;
        this.defaultApiReply = defaultApiReply;
        this.logger = logger(loggerName);
        this.options = options || { 
            method: 'GET',
            timeout: DEFAULT_TIMEOUT_MS
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
        const { timeout: configuredTimeout, idleTimeout, maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES, ...requestOptions } = this.options;
        const timeout = configuredTimeout > 0 ? configuredTimeout : DEFAULT_TIMEOUT_MS;

        try {
            const url = this.apiUrl + '?' + this.sanitizeRequestData(requestData).toString();
            // Debug only: the query string holds the user's search terms
            this.logger.debug(url);

            // Unlike a socket timeout, the deadline also stops a backend that keeps sending a few bytes at a
            // time, and it covers the drain of a non-2xx body. When it fires, the request is destroyed and
            // the 'error' handler below gets an AbortError.
            const signal = AbortSignal.timeout(timeout);

            const apiReq = request(url, { ...requestOptions, timeout: idleTimeout, signal }, (apiRes) => {
                // Handle non-2xx status codes
                if (apiRes.statusCode < 200 || apiRes.statusCode >= 300) {
                    this.logger.error(`${this.apiUrl} : Invalid status code: ${apiRes.statusCode}`);
                    // Discard the body, so the socket is released instead of held until it times out
                    apiRes.resume();
                    safeCallback(this.fallbackReply(requestData));
                    return;
                }

                // Decode the body as UTF-8 text across chunks, so a multibyte character split
                // between two chunks isn't garbled (subclasses get string chunks)
                apiRes.setEncoding('utf8');

                apiRes.on('error', (e) => {
                    this.logger.error(`${this.apiUrl} : Response error: ${e.message}`);
                    safeCallback(this.fallbackReply(requestData));
                });

                // Give up on a body that is too large, before it fills the memory.
                // The chunks are already decoded strings (setEncoding above), so this counts their UTF-8
                // re-encoding, not the bytes received. That is never less than what was received: valid
                // UTF-8 re-encodes to the same bytes, and each invalid sequence (1 to 3 bytes) becomes
                // U+FFFD (3 bytes). So the cap can only trip a little early, never late.
                let receivedBytes = 0;
                apiRes.on('data', (chunk) => {
                    receivedBytes += Buffer.byteLength(chunk);
                    if (receivedBytes > maxResponseBytes) {
                        this.logger.error(`${this.apiUrl} : Response too large (over ${maxResponseBytes} bytes)`);
                        apiReq.destroy();
                        safeCallback(this.fallbackReply(requestData));
                    }
                });

                // Delegate response processing to subclass
                this.processResponse(apiRes, safeCallback, requestData);
            });

            // Handle request errors, including the deadline (AbortError)
            apiReq.on('error', (e) => {
                if (e.name === 'AbortError') {
                    this.logger.error(`${this.apiUrl} : Timeout (${timeout}ms)`);
                } else {
                    this.logger.error(`${this.apiUrl} : Request error: ${e.message}`);
                }
                if (!apiReq.destroyed) {
                    apiReq.destroy();
                }
                safeCallback(this.fallbackReply(requestData));
            });

            // Handle the inactivity timeout, if there is one
            if (idleTimeout) {
                apiReq.on('timeout', () => {
                    this.logger.error(`${this.apiUrl} : Timeout (no data for ${idleTimeout}ms)`);
                    apiReq.destroy();
                    safeCallback(this.fallbackReply(requestData));
                });
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
     * Called for 2xx responses only. The body is already set to UTF-8 (the 'data' chunks
     * are strings) and response errors are already handled (fallback reply).
     *
     * @abstract
     * @param {http.IncomingMessage} _apiRes - HTTP response object
     * @param {Function} _safeCallback - Safe callback to invoke with result
     * @param {URLSearchParams} _requestData - Original request parameters (for context)
     */
    processResponse(_apiRes, _safeCallback, _requestData) {
        throw new Error('processResponse() must be implemented by subclass');
    }

    /**
     * Reply passed to the callback when the request fails (non-2xx status, request
     * or response error, timeout, response too large, exception)
     *
     * @param {URLSearchParams} _requestData - Original request parameters (for context)
     * @returns {*} The default reply
     */
    fallbackReply(_requestData) {
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
