/**
 * Standalone HTTP fixture server used by Playwright's "mocked" mode.
 *
 * The webapp under test (this repo) does all its backend calls (textsearch,
 * imagesearch, cdx, pywb) server-side in Node, so Playwright's page.route()
 * can't intercept them. Instead, playwright.config.js points the app's
 * backend-derived config env vars (BACKEND_URL, WAYBACK_URL, PYWB_URL,
 * TEXT_SEARCH_API_SOLR/NUTCHWAX/DEFAULT, IMAGE_SEARCH_API, CDX_API) at this
 * process, and it serves deterministic canned data for all of them. See
 * fixtures.js for the exact data contract.
 */
const http = require('http');
const { URL } = require('url');
const {
    buildPageSearchResults,
    buildMetadataResult,
    buildImageSearchResults,
    buildCdxResults,
} = require('./fixtures');

function sendJson(res, statusCode, data) {
    const body = JSON.stringify(data);
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(body);
}

function sendNdjson(res, statusCode, items) {
    const body = items.map((item) => JSON.stringify(item)).join('\n') + '\n';
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(body);
}

function handleTextSearch(query, res) {
    if (query.has('metadata')) {
        sendJson(res, 200, buildMetadataResult(query.get('metadata')));
        return;
    }
    sendJson(res, 200, buildPageSearchResults({
        q: query.get('q'),
        from: query.get('from'),
        to: query.get('to'),
        offset: query.get('offset'),
        maxItems: query.get('maxItems'),
    }));
}

function handleImageSearch(query, res) {
    sendJson(res, 200, buildImageSearchResults({
        q: query.get('q'),
        offset: query.get('offset'),
        maxItems: query.get('maxItems'),
    }));
}

function handleCdx(query, res) {
    sendNdjson(res, 200, buildCdxResults(query.get('url') ?? ''));
}

function handlePywbReplay(res) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body>Mock replay OK</body></html>');
}

function createMockServer() {
    return http.createServer((req, res) => {
        const url = new URL(req.url, 'http://localhost');

        if (url.pathname === '/textsearch' || url.pathname === '/textsearchnutchwax') {
            handleTextSearch(url.searchParams, res);
        } else if (url.pathname === '/imagesearch') {
            handleImageSearch(url.searchParams, res);
        } else if (url.pathname === '/wayback/cdx') {
            handleCdx(url.searchParams, res);
        } else if (url.pathname.startsWith('/noFrame/replay')) {
            handlePywbReplay(res);
        } else {
            // Fire-and-forget endpoints (e.g. archivepagenow logging) and
            // anything else unmocked: just acknowledge so the app doesn't
            // hang waiting on a response.
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('OK');
        }
    });
}

if (require.main === module) {
    const port = process.env.MOCK_SERVER_PORT || 4100;
    const server = createMockServer();
    server.listen(port, () => {
        console.log(`e2e mock server listening on http://localhost:${port}`);
    });
}

module.exports = { createMockServer };
