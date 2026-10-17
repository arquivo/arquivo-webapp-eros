'use strict';

const BaseApiRequest = require('./base-api-request');
const config = require('config');
const todayYmd = require('../utils/today-ymd');

// How much of a malformed capture goes into the parse-error log line
const MAX_LOGGED_FRAGMENT_LENGTH = 200;

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
            to: todayYmd(),
            filter: '!:~status:4|5',
            fields: 'url,timestamp,status,digest'
        };
        const defaultApiReply = [];
        // The reply is streamed: the largest ones (the server stops at 100,000 captures, about 13 MB)
        // take about 10 s, with gaps under 0.5 s. Give up when no data comes for 5 s, after 1 minute
        // in total, or past 64 MB.
        const options = { method: 'GET', timeout: 60000, idleTimeout: 5000, maxResponseBytes: 64 * 1024 * 1024 };

        super(apiUrl, defaultApiParams, defaultApiReply, 'CDXSearchApiRequest', options);
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
            apiReply += chunk;
            
            // Parse complete JSON objects (newline-delimited)
            let endIndex = apiReply.indexOf('}') + 1;
            while (endIndex > 0) {
                let currentJson = apiReply.slice(0, endIndex);
                try {
                    let currentData = JSON.parse(currentJson);
                    apiData.push(currentData);
                } catch (e) {
                    // Log and skip malformed JSON, continue processing. Log only the start of the
                    // fragment, so a malformed reply can't write a huge log line.
                    const fragment = currentJson.length > MAX_LOGGED_FRAGMENT_LENGTH
                        ? `${currentJson.slice(0, MAX_LOGGED_FRAGMENT_LENGTH)}... (${currentJson.length} chars)`
                        : currentJson;
                    this.logger.error(`Failed to parse JSON object: ${fragment}. Error: ${e.message}`);
                }
                apiReply = apiReply.slice(endIndex + 1);
                endIndex = apiReply.indexOf('}') + 1;
            }
        });

        // Return parsed array on end
        apiRes.on('end', () => {
            safeCallback(apiData);
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