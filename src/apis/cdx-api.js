const https = require('https');
const http = require('http');
const logger = require('../logger');
const config = require('config');

/**
 * CDXSearchApiRequest - Standalone HTTP client for CDX API with streaming JSON parsing
 * 
 * This class is standalone (does not extend ApiRequest) because it requires special
 * streaming JSON parsing that processes newline-delimited JSON objects incrementally.
 * 
 * Features:
 * - Streaming JSON parsing (handles newline-delimited JSON)
 * - Graceful handling of malformed JSON (logs errors, continues processing)
 * - Memory-safe (uses local variables per request)
 * - Safe callback invocation (prevents multiple calls)
 * 
 * @class
 */
class CDXSearchApiRequest {
    constructor() {
        this.apiUrl = config.get('cdx.api');
        this.defaultApiParams = {
            output: 'json',
            from: config.get('search.start.date'),
            url: '',
            to: (new Date()).toLocaleDateString('en-CA').split('-').join(''),
            filter: '!:~status:4|5',
            fields: 'url,timestamp,status,digest'
        };
        this.defaultApiReply = [];
        this.logger = logger('CDXSearchApiRequest');
        this.options = { method: 'GET' };
    }

    /**
     * Performs a GET request with streaming JSON parsing
     * 
     * Processes newline-delimited JSON objects incrementally as data chunks arrive.
     * Invalid JSON objects are logged and skipped, allowing processing to continue.
     * 
     * @param {URLSearchParams} requestData - Query parameters
     * @param {Function} callback - Callback function(array) with parsed JSON objects
     */
    get(requestData, callback) {
        // Local variables for memory safety
        let apiReply = '';
        let apiData = [];
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
                // Handle non-2xx status codes
                if (apiRes.statusCode < 200 || apiRes.statusCode >= 300) {
                    this.logger.error(`${this.apiUrl} : Invalid status code: ${apiRes.statusCode}`);
                    safeCallback(this.defaultApiReply);
                    return;
                }

                // STREAMING JSON PARSING: Process data chunks as they arrive
                apiRes.on('data', (chunk) => {
                    apiReply += chunk.toString();
                    
                    // Parse complete JSON objects (newline-delimited)
                    let endIndex = apiReply.indexOf('}') + 1;
                    while (endIndex > 0) {
                        let currentJson = apiReply.slice(0, endIndex);
                        try {
                            let currentData = JSON.parse(currentJson);
                            apiData.push(currentData);
                        } catch (e) {
                            // Log and skip malformed JSON, continue processing
                            this.logger.error('Failed to parse following JSON object: ' + currentJson);
                        }
                        apiReply = apiReply.slice(endIndex + 1);
                        endIndex = apiReply.indexOf('}') + 1;
                    }
                });

                // Return parsed array on end
                apiRes.on('end', () => {
                    safeCallback(apiData);
                });

                // Handle response errors
                apiRes.on('error', (e) => {
                    this.logger.error(`${this.apiUrl} : Response error: ${e.message}`);
                    safeCallback(this.defaultApiReply);
                });
            });

            // Handle request errors
            apiReq.on('error', (e) => {
                this.logger.error(`${this.apiUrl} : Request error: ${e.message}`);
                safeCallback(this.defaultApiReply);
            });

            // Handle timeout
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
     * Sanitizes and merges request parameters with defaults
     * Maps 'q' parameter to 'url' for CDX API compatibility
     * 
     * @param {URLSearchParams} requestData - Request-specific parameters
     * @returns {URLSearchParams} Sanitized and merged parameters
     */
    sanitizeRequestData(requestData) {
        const apiRequestData = new URLSearchParams();

        // Map 'q' to 'url' if present
        if (requestData.has('q')) {
            requestData.set('url', requestData.get('q'));
        }
        
        // Merge defaultApiParams with requestData
        Object.keys(this.defaultApiParams)
            .filter(key => this.defaultApiParams[key] !== null || requestData.has(key))
            .forEach(key => apiRequestData.set(key, requestData.get(key) ?? this.defaultApiParams[key]));
            
        return apiRequestData;
    }
}

module.exports = CDXSearchApiRequest