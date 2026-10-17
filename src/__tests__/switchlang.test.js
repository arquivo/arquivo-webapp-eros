'use strict';

// SEC-11 — Open redirect via /switchlang (missing return in referer guard)

jest.mock('../../src/apis/page-search-api');
jest.mock('../../src/apis/image-search-api');
jest.mock('../../src/apis/cdx-api');
jest.mock('../../src/apis/suggestion-api');
// Keep the 500 response below from printing a stack trace
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
jest.mock('../logger', () => jest.fn(() => mockLogger));

const request = require('supertest');
const app = require('../../app');

describe('SEC-11 — /switchlang open-redirect regression', () => {

    it('redirects to / when Referer hostname is not in the allow-list', async () => {
        const res = await request(app)
            .get('/switchlang')
            .set('Referer', 'http://evil.com/steal?data=secret');
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/');
    });

    it('does NOT redirect to the attacker referer when hostname is untrusted', async () => {
        const res = await request(app)
            .get('/switchlang')
            .set('Referer', 'http://evil.com/steal?data=secret');
        expect(res.headers.location).not.toContain('evil.com');
    });

    it('redirects to the referer path when Referer hostname is localhost', async () => {
        const res = await request(app)
            .get('/switchlang')
            .set('Referer', 'http://localhost/search?q=test');
        expect(res.status).toBe(302);
        expect(res.headers.location).not.toContain('evil.com');
        expect(res.headers.location).toMatch(/^\/search/);
    });

    it('redirects to / when there is no Referer header', async () => {
        const res = await request(app).get('/switchlang');
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/');
    });

    it('does not follow redirects to external hosts for subdomain bypass attempts', async () => {
        const res = await request(app)
            .get('/switchlang')
            .set('Referer', 'http://evil.com.localhost/path');
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/');
    });

});

// Characterization tests (#85): pin the current /switchlang behaviour (cookies,
// redirect target, wayback vs non-wayback, cache headers, invalid input).
describe('/switchlang characterization (#85)', () => {

    // Trusted hosts: localhost and the hostname of backend.url (__mocks__/config.js)
    const BACKEND = 'https://preprod.arquivo.pt';

    const i18nCookies = (res) => (res.headers['set-cookie'] || []).filter(c => c.startsWith('i18n='));
    const libraryCookie = (value) => new RegExp(`^i18n=${value}; Max-Age=900; Path=/; Expires=[^;]+; HttpOnly$`);
    const appCookie = (value) => new RegExp(`^i18n=${value}; Max-Age=900; Path=/; Expires=[^;]+$`);
    const CLEARED_COOKIE = 'i18n=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT';

    function switchlang(referer, { cookie, query = '' } = {}) {
        let req = request(app).get('/switchlang' + query);
        if (referer !== undefined) req = req.set('Referer', referer);
        if (cookie !== undefined) req = req.set('Cookie', cookie);
        return req;
    }

    function expectNoCacheHeaders(res) {
        expect(res.headers['cache-control']).toBe('no-cache, no-store, must-revalidate');
        expect(res.headers.pragma).toBe('no-cache');
        expect(res.headers.expires).toBe('0');
    }

    function expectNoSwitch(res) {
        // Only the two cookies set on every request; no cache headers
        const cookies = i18nCookies(res);
        expect(cookies).toHaveLength(2);
        expect(cookies[0]).toMatch(libraryCookie('pt_PT'));
        expect(cookies[1]).toMatch(appCookie('pt_PT'));
        expect(res.headers['cache-control']).toBeUndefined();
        expect(res.headers.pragma).toBeUndefined();
        expect(res.headers.expires).toBeUndefined();
    }

    describe('trusted referer, non-wayback path', () => {
        it('switches pt_PT to en: adds l=en to the referer path and query', async () => {
            const res = await switchlang('http://localhost/search?q=test');
            expect(res.status).toBe(302);
            expect(res.headers.location).toBe('/search?q=test&l=en');
        });

        it('switches en_GB (cookie) to pt: adds l=pt', async () => {
            const res = await switchlang('http://localhost/search?q=test', { cookie: 'i18n=en_GB' });
            expect(res.headers.location).toBe('/search?q=test&l=pt');
        });

        it('replaces an existing l and keeps the fragment', async () => {
            const res = await switchlang(BACKEND + '/page/search?l=en&q=a#results', { cookie: 'i18n=en_GB' });
            expect(res.headers.location).toBe('/page/search?l=pt&q=a#results');
        });

        it('adds l to a referer without a query', async () => {
            const res = await switchlang(BACKEND + '/');
            expect(res.headers.location).toBe('/?l=en');
        });

        it('takes the current locale from the l parameter of the /switchlang request', async () => {
            const res = await switchlang('http://localhost/search?q=test', { query: '?l=en' });
            expect(res.headers.location).toBe('/search?q=test&l=pt');
        });

        it('clears the i18n cookie, then sets the new locale (not HttpOnly)', async () => {
            const res = await switchlang('http://localhost/search?q=test');
            const cookies = i18nCookies(res);
            expect(cookies).toHaveLength(4);
            expect(cookies[0]).toMatch(libraryCookie('pt_PT'));
            expect(cookies[1]).toMatch(appCookie('pt_PT'));
            expect(cookies[2]).toBe(CLEARED_COOKIE);
            expect(cookies[3]).toMatch(appCookie('en_GB'));
        });

        it('sets the new locale cookie pt_PT when switching from en_GB', async () => {
            const res = await switchlang('http://localhost/', { cookie: 'i18n=en_GB' });
            const cookies = i18nCookies(res);
            expect(cookies[2]).toBe(CLEARED_COOKIE);
            expect(cookies[3]).toMatch(appCookie('pt_PT'));
        });

        it('sets no-cache headers', async () => {
            const res = await switchlang('http://localhost/search?q=test');
            expectNoCacheHeaders(res);
        });
    });

    describe('trusted referer, wayback path', () => {
        const waybackReferer = BACKEND + '/wayback/20200101000000/http://example.pt/?l=pt';

        it('redirects to the referer path and query unchanged (no l added or replaced)', async () => {
            const res = await switchlang(waybackReferer);
            expect(res.status).toBe(302);
            expect(res.headers.location).toBe('/wayback/20200101000000/http://example.pt/?l=pt');
        });

        it('still switches the cookie and sets no-cache headers', async () => {
            const res = await switchlang(waybackReferer, { cookie: 'i18n=en_GB' });
            const cookies = i18nCookies(res);
            expect(cookies[2]).toBe(CLEARED_COOKIE);
            expect(cookies[3]).toMatch(appCookie('pt_PT'));
            expectNoCacheHeaders(res);
        });
    });

    describe('untrusted or missing referer', () => {
        it('redirects to / without switching for an untrusted host', async () => {
            const res = await switchlang('http://evil.com/steal?data=secret');
            expect(res.headers.location).toBe('/');
            expectNoSwitch(res);
        });

        it('redirects to / without switching when there is no referer', async () => {
            const res = await switchlang(undefined);
            expect(res.headers.location).toBe('/');
            expectNoSwitch(res);
        });

        it('redirects to / for an empty referer', async () => {
            const res = await switchlang('');
            expect(res.status).toBe(302);
            expect(res.headers.location).toBe('/');
        });
    });

    describe('invalid referer', () => {
        it('a referer that is not a URL gives 500', async () => {
            const res = await switchlang('not a url');
            expect(res.status).toBe(500);
            expect(res.text).toBe('Internal Server Error');
        });
    });
});
