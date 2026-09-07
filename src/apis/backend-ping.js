const https = require('node:https');
const http = require('node:http');
const logger = require('../logger')('BackendPing');

/**
 * Checks whether a backend URL is reachable and responding correctly.
 *
 * `url` should be a request that's expected to succeed (e.g. a minimal valid
 * search query), since some backends (Solr, CDX) return 4xx for a bare GET
 * with no query params even when perfectly healthy. Only a 2xx response
 * counts as reachable — 3xx is deliberately excluded too, since Wayback/pywb
 * treats an unmatched path segment as a URL to look up and redirects (307)
 * instead of 404ing, which would otherwise mask a wrong/broken cdx.api path
 * as healthy. 4xx/5xx responses, connection errors, and timeouts all count
 * as unreachable.
 *
 * @param {string} url - Backend URL to check
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<{reachable: boolean, statusCode?: number, error?: string}>}
 */
function pingBackend(url, timeoutMs = 3000) {
    return new Promise((resolve) => {
        let settled = false;
        const resolveOnce = (result) => {
            if (!settled) {
                settled = true;
                resolve(result);
            }
        };

        const request = url.startsWith('https') ? https.request : http.request;

        let req;
        try {
            req = request(url, { method: 'GET', timeout: timeoutMs }, (res) => {
                res.resume(); // discard the response body, we only care about the status code
                const reachable = res.statusCode >= 200 && res.statusCode < 300;
                if (reachable) {
                    resolveOnce({ reachable: true, statusCode: res.statusCode });
                } else {
                    logger.error(`${url} : Unhealthy status code: ${res.statusCode}`);
                    resolveOnce({ reachable: false, statusCode: res.statusCode, error: `HTTP ${res.statusCode}` });
                }
            });
        } catch (e) {
            logger.error(`${url} : Exception: ${e.message}`);
            resolveOnce({ reachable: false, error: e.message });
            return;
        }

        req.on('error', (e) => {
            logger.error(`${url} : Request error: ${e.message}`);
            resolveOnce({ reachable: false, error: e.message });
        });

        req.on('timeout', () => {
            logger.error(`${url} : Timeout (${timeoutMs}ms)`);
            req.destroy();
            resolveOnce({ reachable: false, error: 'timeout' });
        });

        req.end();
    });
}

module.exports = pingBackend;
