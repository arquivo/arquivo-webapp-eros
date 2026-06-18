'use strict';

const request = require('supertest');

// Mock API modules before app is loaded
jest.mock('../../src/apis/page-search-api');
jest.mock('../../src/apis/image-search-api');
jest.mock('../../src/apis/cdx-api');
jest.mock('../../src/apis/suggestion-api');

const PageSearchApiRequest = require('../../src/apis/page-search-api');
const CDXSearchApiRequest = require('../../src/apis/cdx-api');
const SuggestionApi = require('../../src/apis/suggestion-api');

const NO_RESULTS = { estimated_nr_results: 0, response_items: [] };

PageSearchApiRequest.mockImplementation(() => ({
    get: (_data, cb) => cb(NO_RESULTS),
    sanitizeRequestData: (data) => data,
}));

CDXSearchApiRequest.mockImplementation(() => ({
    get: (_data, cb) => cb([]),
    sanitizeRequestData: (data) => data,
}));

SuggestionApi.mockImplementation(() => ({
    get: (_query, _lang, cb) => cb(null),
}));

const app = require('../../app');

const ATTR_BREAK    = '"><script>alert(1)</script>';
const JAVASCRIPT    = 'javascript:alert(document.cookie)';

describe('SEC-01 — Reflected XSS regression', () => {

    describe('GET /services/archivepagenow — url input pre-fill', () => {
        it('blanks the input value for an attribute-breaking XSS payload', async () => {
            const res = await request(app)
                .get(`/services/archivepagenow?url=${encodeURIComponent(ATTR_BREAK)}`);
            expect(res.status).toBe(200);
            expect(res.text).not.toContain(ATTR_BREAK);
            expect(res.text).toContain('value=""');
        });

        it('blanks the input value for a javascript: URI', async () => {
            const res = await request(app)
                .get(`/services/archivepagenow?url=${encodeURIComponent(JAVASCRIPT)}`);
            expect(res.status).toBe(200);
            expect(res.text).toContain('value=""');
        });

        it('pre-fills a valid URL without modification', async () => {
            const res = await request(app)
                .get('/services/archivepagenow?url=http://example.com');
            expect(res.status).toBe(200);
            expect(res.text).toContain('value="http://example.com"');
        });
    });

    describe('GET /services/complete-page — url reflected in header and iframe', () => {
        const TS = '20200101000000';

        it('rejects the XSS payload via isValidUrl — alert payload absent from response', async () => {
            const res = await request(app)
                .get(`/services/complete-page?url=${encodeURIComponent(ATTR_BREAK)}&timestamp=${TS}`);
            expect(res.status).toBe(200);
            expect(res.text).not.toContain('alert(1)');
            expect(res.text).not.toContain(ATTR_BREAK);
        });

        it('rejects a javascript: URI — href attribute is empty', async () => {
            const res = await request(app)
                .get(`/services/complete-page?url=${encodeURIComponent(JAVASCRIPT)}&timestamp=${TS}`);
            expect(res.status).toBe(200);
            expect(res.text).not.toContain('javascript:');
        });

        it('renders a valid URL in the header link and iframe src', async () => {
            const res = await request(app)
                .get(`/services/complete-page?url=http://example.com&timestamp=${TS}`);
            expect(res.status).toBe(200);
            expect(res.text).toContain('href="http://example.com"');
            expect(res.text).toContain('http://example.com');
        });
    });

    describe('GET /page/search — body-not-found i18n URL interpolation', () => {
        it('percent-encodes the query in the ArchivePageNow href — raw payload never unescaped', async () => {
            const res = await request(app)
                .get(`/page/search?q=${encodeURIComponent(ATTR_BREAK)}`);
            expect(res.status).toBe(200);
            expect(res.text).not.toContain(ATTR_BREAK);
        });
    });

    describe('GET /url/search — body-not-found fourth suggestion URL interpolation', () => {
        it('percent-encodes the query in ArchivePageNow and web.archive.org hrefs — raw payload never unescaped', async () => {
            const res = await request(app)
                .get(`/url/search?q=${encodeURIComponent(ATTR_BREAK)}`);
            expect(res.status).toBe(200);
            expect(res.text).not.toContain(ATTR_BREAK);
        });
    });

    describe('body-not-found.ejs — i18n url interpolation unit test', () => {
        const ejs = require('ejs');
        const path = require('path');

        const TEMPLATE = path.join(__dirname, '../../views/templates/body/body-not-found.ejs');

        function buildT(translations) {
            return (key, vars = {}) => {
                const tpl = translations[key] || '';
                return tpl.replace(/\$\{(\w+)\}/g, (_, k) => vars[k] ?? '');
            };
        }

        it('encodes url-search query in ArchivePageNow href — encoded form present, raw form absent', async () => {
            const t = buildT({
                'page-search.not-found.accessibility.title': '',
                'page-search.not-found.accessibility.message': '',
                'page-search.not-found.message': '',
                'page-search.not-found.suggestions.title': '',
                'page-search.not-found.suggestions.url-search.first': '',
                'page-search.not-found.suggestions.url-search.second': '<a href="/services/archivepagenow?url=${url}">ArchivePageNow</a>',
                'page-search.not-found.suggestions.url-search.third': '',
                'page-search.not-found.suggestions.url-search.fourth': '<a href="//web.archive.org/web/*/${url}">Search</a>',
            });

            const html = await ejs.renderFile(TEMPLATE, {
                query: ATTR_BREAK,
                suggestion: ATTR_BREAK,
                searchType: 'url-search',
                t,
            }, { views: [path.join(__dirname, '../../views')] });

            expect(html).not.toContain(ATTR_BREAK);
            expect(html).toContain(encodeURIComponent(ATTR_BREAK));
        });
    });

});
