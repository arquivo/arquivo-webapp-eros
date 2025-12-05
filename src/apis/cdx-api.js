const BaseApiRequest = require('./base-api-request');
const config = require('config');

/**
 * CDXSearchApiRequest - HTTP client for CDX API with streaming JSON parsing
 * 
 * Extends BaseApiRequest with special streaming JSON parsing that processes
 * newline-delimited JSON objects incrementally.
 * 
 * Features:
 * - Streaming JSON parsing (handles newline-delimited JSON)
 * - Graceful handling of malformed JSON (logs errors, continues processing)
 * - Memory-safe (uses local variables per request)
 * - Safe callback invocation (prevents multiple calls)
 * 
 * @class
 * @extends BaseApiRequest
 */
class CDXSearchApiRequest extends BaseApiRequest {
    constructor() {
        const apiUrl = config.get('cdx.api');
        const defaultApiParams = {
            output: 'json',
            from: config.get('search.start.date'),
            url: '',
            to: (new Date()).toLocaleDateString('en-CA').split('-').join(''),
            filter: '!:~status:4|5',
            fields: 'url,timestamp,status,digest'
        };
        const defaultApiReply = [];
        
        super(apiUrl, defaultApiParams, defaultApiReply, 'CDXSearchApiRequest', { method: 'GET' });
    }

    /**
     * Process HTTP response with streaming JSON parsing
     * 
     * Processes newline-delimited JSON objects incrementally as data chunks arrive.
     * Invalid JSON objects are logged and skipped, allowing processing to continue.
     * 
     * @param {http.IncomingMessage} apiRes - HTTP response object
     * @param {Function} safeCallback - Safe callback to invoke with parsed array
     */
    processResponse(apiRes, safeCallback) {
        let apiReply = '';
        let apiData = [];

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
    }

    /**
     * Sanitizes and merges request parameters with defaults
     * Maps 'q' parameter to 'url' for CDX API compatibility
     * 
     * @param {URLSearchParams} requestData - Request-specific parameters
     * @returns {URLSearchParams} Sanitized and merged parameters
     */
    sanitizeRequestData(requestData) {
        // Map 'q' to 'url' if present (CDX API specific)
        if (requestData.has('q')) {
            requestData.set('url', requestData.get('q'));
        }
        
        // Use parent class implementation for standard merging
        return super.sanitizeRequestData(requestData);
    }
}

module.exports = CDXSearchApiRequest