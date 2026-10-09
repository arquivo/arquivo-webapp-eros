/**
 * Canned data served by the e2e mock server (e2e/mock-server/index.js).
 *
 * Contract used by specs under e2e/webapp/**:
 * - Any page/image search query is treated as "has results" and returns a
 *   fixed corpus of TOTAL_PAGE_RESULTS / TOTAL_IMAGE_RESULTS items, paginated
 *   using the same `offset`/`maxItems` params the app sends. This makes
 *   pagination (next/previous/last page) deterministic regardless of query.
 * - NO_RESULTS_QUERY (or any query containing it) always returns zero
 *   results, for "no results found" specs.
 * - When a page search asks for `fields=spellcheck`, MISSPELLED_QUERY gets
 *   SPELLCHECKED_QUERY as `suggested_query` and any other query gets '' (no
 *   suggestion), like the real text search API. Image search uses the same
 *   page search call (with maxItems=0) for its suggestion.
 * - Any /wayback/<timestamp>/<url> visit succeeds (mocked pywb + a canned
 *   metadata record), so replay-toolbar/menu/technical-details specs don't
 *   depend on real archived content.
 * - Any url-search / replay-nav CDX lookup returns a fixed set of 5
 *   old (pre-2020) snapshots for whatever url was requested.
 */

// Must not look like a URL/domain (no dot) — the app's /page/search route
// redirects URL-shaped queries to /url/search before it ever reaches here.
const NO_RESULTS_QUERY = 'ddadfcfe qwzxjk nosuchresult';
// Same pair as a real misspelling on preprod, so specs work in live mode too.
const MISSPELLED_QUERY = 'Lizboa';
const SPELLCHECKED_QUERY = 'lisboa';
const TOTAL_PAGE_RESULTS = 47;
const TOTAL_IMAGE_RESULTS = 47;

// Archive-link fields below are rendered directly into <img src> / <a href>
// by the app's own templates (e.g. views/templates/fragments/image-result.ejs
// uses imgLinkToArchive verbatim). They must point back at this mock server
// rather than the real arquivo.pt — otherwise the browser tries to load 25+
// images from the real, unmocked domain, which can hang page load entirely
// in network-restricted environments (CI, sandboxes).
const MOCK_SERVER_PORT = process.env.MOCK_SERVER_PORT || 4100;
const MOCK_ORIGIN = `http://localhost:${MOCK_SERVER_PORT}`;

function isNoResultsQuery(q) {
    return !q || q.includes(NO_RESULTS_QUERY);
}

function buildPageResponseItem(index, query) {
    const tstamp = `20180101${String(100000 + index).slice(-6)}`;
    return {
        title: `Mock result ${index + 1} for ${query}`,
        originalURL: `http://example.com/mock-page-${index + 1}`,
        linkToArchive: `${MOCK_ORIGIN}/wayback/${tstamp}/http://example.com/mock-page-${index + 1}`,
        linkToNoFrameArchive: `${MOCK_ORIGIN}/noFrame/replay/${tstamp}/http://example.com/mock-page-${index + 1}`,
        snippet: `This is a mock snippet mentioning ${query} for result ${index + 1}.`,
        mimeType: 'text/html',
        contentLength: 12345,
        digest: `MOCKDIGEST${index}`,
        tstamp,
        encoding: 'UTF-8',
    };
}

function buildSpellcheck(query, fields) {
    if (!(fields ?? '').split(',').includes('spellcheck')) {
        return {};
    }
    // The app sends the query without its inline terms (e.g. 'Lizboa collection:X' -> 'Lizboa '),
    // and the real API keeps that trailing space in its suggestion
    return { suggested_query: query.trim() === MISSPELLED_QUERY ? query.replace(MISSPELLED_QUERY, SPELLCHECKED_QUERY) : '' };
}

function buildPageSearchResults({ q, from, to, offset, maxItems, fields }) {
    const query = q ?? '';
    const start = parseInt(offset ?? '0', 10) || 0;
    // maxItems=0 is a valid request (spellcheck only), so don't fall back to 10 for it
    const size = maxItems === '0' ? 0 : parseInt(maxItems ?? '10', 10) || 10;

    if (isNoResultsQuery(query)) {
        return {
            estimated_nr_results: 0,
            response_items: [],
            request_parameters: { from: from ?? '', to: to ?? '' },
            ...buildSpellcheck(query, fields),
        };
    }

    const items = [];
    for (let i = start; i < Math.min(start + size, TOTAL_PAGE_RESULTS); i++) {
        items.push(buildPageResponseItem(i, query));
    }

    return {
        estimated_nr_results: TOTAL_PAGE_RESULTS,
        response_items: items,
        request_parameters: { from: from ?? '', to: to ?? '' },
        ...buildSpellcheck(query, fields),
    };
}

function buildMetadataResult(metadata) {
    const [url, timestamp] = [metadata.split('/').slice(0, -1).join('/'), metadata.split('/').pop()];
    return {
        estimated_nr_results: 1,
        response_items: [
            {
                title: 'Mock Archived Page',
                originalURL: url,
                collection: 'MockCollection',
                mimeType: 'text/html',
                contentLength: 12345,
                digest: 'MOCKDIGESTMETA',
                tstamp: timestamp,
                encoding: 'UTF-8',
            },
        ],
        request_parameters: {},
    };
}

function buildImageResponseItem(index, query) {
    const tstamp = `20180101${String(100000 + index).slice(-6)}`;
    return {
        imgSrc: `http://example.com/mock-image-${index + 1}.jpg`,
        imgMimeType: 'image/jpeg',
        imgHeight: 480,
        imgWidth: 640,
        imgTstamp: tstamp,
        imgTitle: [`Mock image ${index + 1} for ${query}`],
        imgAlt: [`Mock image ${index + 1}`],
        imgCaption: '',
        imgLinkToArchive: `${MOCK_ORIGIN}/noFrame/replay/${tstamp}/http://example.com/mock-image-${index + 1}.jpg`,
        pageURL: `http://example.com/mock-page-${index + 1}`,
        pageTstamp: tstamp,
        pageLinkToArchive: `${MOCK_ORIGIN}/wayback/${tstamp}/http://example.com/mock-page-${index + 1}`,
        pageTitle: `Mock result ${index + 1} for ${query}`,
        collection: 'MockCollection',
        imgDigest: `MOCKIMGDIGEST${index}`,
        pageHost: 'example.com',
        pageImages: 1,
        safe: true,
    };
}

function buildImageSearchResults({ q, offset, maxItems }) {
    const query = q ?? '';
    const start = parseInt(offset ?? '0', 10) || 0;
    const size = parseInt(maxItems ?? '25', 10) || 25;

    if (isNoResultsQuery(query)) {
        return { totalItems: 0, responseItems: [] };
    }

    const items = [];
    for (let i = start; i < Math.min(start + size, TOTAL_IMAGE_RESULTS); i++) {
        items.push(buildImageResponseItem(i, query));
    }

    return { totalItems: TOTAL_IMAGE_RESULTS, responseItems: items };
}

const CDX_SNAPSHOT_TIMESTAMPS = [
    '20150615120000',
    '20160820130000',
    '20170910140000',
    '20180705150000',
    '20190312160000',
];

function buildCdxResults(url) {
    return CDX_SNAPSHOT_TIMESTAMPS.map((timestamp) => ({
        url,
        timestamp,
        status: '200',
        digest: 'MOCKCDXDIGEST',
    }));
}

module.exports = {
    NO_RESULTS_QUERY,
    MISSPELLED_QUERY,
    SPELLCHECKED_QUERY,
    TOTAL_PAGE_RESULTS,
    TOTAL_IMAGE_RESULTS,
    isNoResultsQuery,
    buildPageSearchResults,
    buildMetadataResult,
    buildImageSearchResults,
    buildCdxResults,
};
