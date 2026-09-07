/**
 * Healthcheck Routes
 *
 * Exposes GET /healthcheck, which checks connectivity to the webapp's
 * backend services (PageSearch, ImageSearch, CDXJ/Wayback) and reports
 * per-backend status plus an overall HTTP status code.
 *
 * Each backend is pinged with a minimal valid query (not a bare GET),
 * because Solr/CDX return 4xx for a request with no query params even when
 * the service itself is perfectly healthy — this way a 4xx/5xx response
 * reflects a genuine problem (wrong path, backend down, ...) rather than a
 * false positive from an incomplete request.
 *
 * This is intentionally separate from the Docker container HEALTHCHECK:
 * a transient backend outage must not make Docker restart otherwise-healthy
 * webapp containers. It's meant to be called explicitly during rolling
 * deploys (e.g. from the Ansible deploy playbook) as a post-deploy gate.
 */

const config = require('config');
const pingBackend = require('./apis/backend-ping');

function buildPingUrl(baseUrl, params) {
    return `${baseUrl}?${new URLSearchParams(params)}`;
}

module.exports = function registerHealthcheckRoutes(router) {
    router.get('/healthcheck', async function healthcheckHandler(req, res) {
        const targets = {
            pageSearch: buildPingUrl(config.get('text.search.api.default'), { q: 'arquivo', maxItems: '1' }),
            imageSearch: buildPingUrl(config.get('image.search.api'), { q: 'arquivo', maxItems: '1' }),
            cdxj: buildPingUrl(config.get('cdx.api'), { output: 'json', url: 'http://example.com', limit: '1' }),
        };

        const entries = await Promise.all(
            Object.entries(targets).map(async ([name, url]) => {
                const { reachable, error } = await pingBackend(url);
                return [name, { status: reachable, message: reachable ? 'OK' : error }];
            })
        );
        const backends = Object.fromEntries(entries);
        const allReachable = Object.values(backends).every((backend) => backend.status);

        res.status(allReachable ? 200 : 503).json(backends);
    });
};
