const BaseApiRequest = require('./base-api-request');

/**
 * JsonApiRequest - HTTP client for APIs that reply with a JSON document
 *
 * The request flow (status check, errors, timeout) is BaseApiRequest's; this class only
 * parses the whole response body as JSON, replying with defaultApiReply when it can't.
 *
 * @class
 * @extends BaseApiRequest
 * @example
 * const api = new JsonApiRequest('https://api.example.com',
 *   { apiKey: 'default-key' },  // default params
 *   { error: 'default' }         // default reply on error
 * );
 *
 * api.get(new URLSearchParams({ query: 'test' }), (data) => {
 *   console.log(data);
 * });
 */
class JsonApiRequest extends BaseApiRequest {
    /**
     * Only here to default the logger name to 'ApiRequest', so log lines and alerts don't change.
     *
     * @param {string} apiUrl - The base URL for API requests
     * @param {Object} defaultApiParams - Default parameters for all requests (optional)
     * @param {Object} defaultApiReply - Fallback response returned on errors (optional)
     * @param {string} loggerName - Logger name for this API client (optional)
     * @param {Object} options - HTTP request options (optional, defaults to GET with a 3 minute timeout)
     */
    constructor(apiUrl, defaultApiParams = {}, defaultApiReply = {}, loggerName = 'ApiRequest', options = null) {
        super(apiUrl, defaultApiParams, defaultApiReply, loggerName, options);
    }

    /**
     * Parses the whole response body as JSON
     *
     * @param {http.IncomingMessage} apiRes - HTTP response object
     * @param {Function} safeCallback - Safe callback to invoke with the parsed data
     * @param {URLSearchParams} requestData - Original request parameters
     */
    processResponse(apiRes, safeCallback, requestData) {
        let apiReply = '';

        apiRes.on('data', (chunk) => {
            apiReply += chunk;
        });

        apiRes.on('end', () => {
            // KNOWN GAP (kept as is, to be fixed by #175): the callback runs inside this
            // try, so an exception thrown by the callback is swallowed and logged as a
            // "JSON parse error" (and the callback isn't called again with the fallback).
            try {
                const apiData = JSON.parse(apiReply);
                safeCallback(apiData);
            } catch (e) {
                this.logger.error(`${this.apiUrl} : JSON parse error: ${e.message}`);
                safeCallback(this.fallbackReply(requestData));
            }
        });
    }
}

module.exports = JsonApiRequest;
