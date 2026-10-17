'use strict';

// Characterization tests for the locale chosen on every request (#85): which
// input wins (the 'l' query parameter, the i18n cookie or the default), the
// i18n cookies set on the response, and what later middleware sees.
// They pin the current behaviour, including its quirks; they are not a spec.

jest.mock('../../src/apis/page-search-api');
jest.mock('../../src/apis/image-search-api');
jest.mock('../../src/apis/cdx-api');
jest.mock('../../src/apis/suggestion-api');
// Keep the 500 responses below from printing stack traces
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
jest.mock('../logger', () => jest.fn(() => mockLogger));

// The traffic logger runs after the locale middleware: replace it with a probe
// that records the request as later middleware sees it.
const mockSeen = [];
jest.mock('../../src/logger/traffic-logger', () => (req, res, next) => {
    mockSeen.push({
        acceptLanguage: req.headers['accept-language'],
        hasAcceptLanguage: Object.hasOwn(req.headers, 'accept-language'),
        l: req.query.l,
    });
    next();
});

const request = require('supertest');
const app = require('../../app');

// Paths starting with '/wayback' take the wayback branch of the locale
// middleware. This one matches no route, so it renders the local 404 page
// (with the locale in <html lang>) and never reaches the replay backend.
const WAYBACK_PATH = '/waybackprobe';

const htmlLang = (res) => (/<html lang="([^"]*)"/.exec(res.text) || [])[1];
const i18nCookies = (res) => (res.headers['set-cookie'] || []).filter(c => c.startsWith('i18n='));

// i18n cookie as set by the i18n library: the chosen locale, HttpOnly
const libraryCookie = (value) => new RegExp(`^i18n=${value}; Max-Age=900; Path=/; Expires=[^;]+; HttpOnly$`);
// i18n cookie as set by the app: readable by scripts (no HttpOnly)
const appCookie = (value) => new RegExp(`^i18n=${value}; Max-Age=900; Path=/; Expires=[^;]+$`);

function get(url, headers = {}) {
    let req = request(app).get(url);
    for (const [name, value] of Object.entries(headers)) {
        req = req.set(name, value);
    }
    return req;
}

describe('locale resolution (characterization, #85)', () => {

    beforeEach(() => {
        mockSeen.length = 0;
    });

    describe('default locale', () => {
        it('uses pt_PT when there is no cookie and no l parameter', async () => {
            const res = await get('/');
            expect(res.status).toBe(200);
            expect(htmlLang(res)).toBe('pt');
        });

        it('sets the library cookie (HttpOnly) and then the app cookie (not HttpOnly), both pt_PT', async () => {
            const res = await get('/');
            const cookies = i18nCookies(res);
            expect(cookies).toHaveLength(2);
            expect(cookies[0]).toMatch(libraryCookie('pt_PT'));
            expect(cookies[1]).toMatch(appCookie('pt_PT'));
        });
    });

    describe('Accept-Language', () => {
        it.each([
            'en-GB,en;q=0.9',
            'en_GB',
            'en',
        ])('is ignored when choosing the locale (%s)', async (acceptLanguage) => {
            const res = await get('/', { 'Accept-Language': acceptLanguage });
            expect(htmlLang(res)).toBe('pt');
            const cookies = i18nCookies(res);
            expect(cookies[0]).toMatch(libraryCookie('pt_PT'));
            expect(cookies[1]).toMatch(appCookie('pt_PT'));
        });

        it('is still seen unchanged by later middleware', async () => {
            await get('/', { 'Accept-Language': 'en-GB,en;q=0.9' });
            expect(mockSeen).toEqual([{ acceptLanguage: 'en-GB,en;q=0.9', hasAcceptLanguage: true, l: undefined }]);
        });

        it('is not added for later middleware when the request has none', async () => {
            await get('/');
            expect(mockSeen).toEqual([{ acceptLanguage: undefined, hasAcceptLanguage: false, l: undefined }]);
        });
    });

    describe('i18n cookie', () => {
        it('selects en_GB and is set again on the response', async () => {
            const res = await get('/', { Cookie: 'i18n=en_GB' });
            expect(htmlLang(res)).toBe('en');
            const cookies = i18nCookies(res);
            expect(cookies[0]).toMatch(libraryCookie('en_GB'));
            expect(cookies[1]).toMatch(appCookie('en_GB'));
        });

        it('wins over Accept-Language', async () => {
            const res = await get('/', { Cookie: 'i18n=pt_PT', 'Accept-Language': 'en' });
            expect(htmlLang(res)).toBe('pt');
        });

        it('accepts a language without region (en)', async () => {
            const res = await get('/', { Cookie: 'i18n=en' });
            expect(htmlLang(res)).toBe('en');
            const cookies = i18nCookies(res);
            expect(cookies[0]).toMatch(libraryCookie('en_GB'));
            expect(cookies[1]).toMatch(appCookie('en'));
        });

        it('falls back to pt_PT for an unknown value, which the app cookie echoes back', async () => {
            const res = await get('/', { Cookie: 'i18n=bogus' });
            expect(htmlLang(res)).toBe('pt');
            const cookies = i18nCookies(res);
            expect(cookies[0]).toMatch(libraryCookie('pt_PT'));
            expect(cookies[1]).toMatch(appCookie('bogus'));
        });

        it('falls back to pt_PT for an empty value', async () => {
            const res = await get('/', { Cookie: 'i18n=' });
            expect(htmlLang(res)).toBe('pt');
            const cookies = i18nCookies(res);
            expect(cookies[0]).toMatch(libraryCookie('pt_PT'));
            expect(cookies[1]).toMatch(appCookie('pt_PT'));
        });
    });

    describe('l query parameter (non-wayback paths)', () => {
        it.each([
            ['en', 'en', 'en_GB'],
            ['en_GB', 'en', 'en_GB'],
            ['pt', 'pt', 'pt_PT'],
        ])('l=%s renders in %s; only the library cookie follows it', async (l, lang, locale) => {
            const res = await get(`/?l=${l}`);
            expect(htmlLang(res)).toBe(lang);
            const cookies = i18nCookies(res);
            expect(cookies[0]).toMatch(libraryCookie(locale));
            expect(cookies[1]).toMatch(appCookie('pt_PT'));
        });

        it('wins over the cookie, which the app cookie keeps', async () => {
            const res = await get('/?l=pt', { Cookie: 'i18n=en_GB' });
            expect(htmlLang(res)).toBe('pt');
            const cookies = i18nCookies(res);
            expect(cookies[0]).toMatch(libraryCookie('pt_PT'));
            expect(cookies[1]).toMatch(appCookie('en_GB'));
        });

        it('falls back to the cookie when the value is unknown', async () => {
            const res = await get('/?l=xx', { Cookie: 'i18n=en_GB' });
            expect(htmlLang(res)).toBe('en');
        });

        it('falls back to the cookie when the value is empty', async () => {
            const res = await get('/?l=', { Cookie: 'i18n=en_GB' });
            expect(htmlLang(res)).toBe('en');
        });

        it('is seen unchanged by later middleware', async () => {
            await get('/?l=en');
            expect(mockSeen).toEqual([{ acceptLanguage: undefined, hasAcceptLanguage: false, l: 'en' }]);
        });
    });

    describe('l query parameter (paths starting with /wayback)', () => {
        it('is ignored in favour of the cookie', async () => {
            const res = await get(`${WAYBACK_PATH}?l=pt`, { Cookie: 'i18n=en_GB' });
            expect(res.status).toBe(404);
            expect(htmlLang(res)).toBe('en');
            const cookies = i18nCookies(res);
            expect(cookies[0]).toMatch(libraryCookie('en_GB'));
            expect(cookies[1]).toMatch(appCookie('en_GB'));
        });

        it('is ignored in favour of the default when there is no cookie', async () => {
            const res = await get(`${WAYBACK_PATH}?l=en`);
            expect(htmlLang(res)).toBe('pt');
            expect(i18nCookies(res)[0]).toMatch(libraryCookie('pt_PT'));
        });

        it('is replaced by the language of the cookie (en_XX selects en_GB)', async () => {
            const res = await get(`${WAYBACK_PATH}?l=pt`, { Cookie: 'i18n=en_XX' });
            expect(htmlLang(res)).toBe('en');
            const cookies = i18nCookies(res);
            expect(cookies[0]).toMatch(libraryCookie('en_GB'));
            expect(cookies[1]).toMatch(appCookie('en_XX'));
        });

        it('without l, an unknown cookie (en_XX) falls back to pt_PT', async () => {
            const res = await get(WAYBACK_PATH, { Cookie: 'i18n=en_XX' });
            expect(htmlLang(res)).toBe('pt');
        });

        it('is restored for later middleware', async () => {
            await get(`${WAYBACK_PATH}?l=pt`, { Cookie: 'i18n=en_GB', 'Accept-Language': 'pt' });
            expect(mockSeen).toEqual([{ acceptLanguage: 'pt', hasAcceptLanguage: true, l: 'pt' }]);
        });

        it('a repeated l is ignored and restored as is', async () => {
            const res = await get(`${WAYBACK_PATH}?l=en&l=pt`);
            expect(res.status).toBe(404);
            expect(htmlLang(res)).toBe('pt');
            expect(mockSeen).toEqual([{ acceptLanguage: undefined, hasAcceptLanguage: false, l: ['en', 'pt'] }]);
        });
    });

    describe('malformed input (current responses)', () => {
        it('a repeated l on a non-wayback path gives 500', async () => {
            const res = await get('/?l=en&l=pt');
            expect(res.status).toBe(500);
            expect(res.text).toBe('Internal Server Error');
        });

        it('a JSON i18n cookie gives 500', async () => {
            const res = await get('/', { Cookie: 'i18n=j:{"a":1}' });
            expect(res.status).toBe(500);
            expect(res.text).toBe('Internal Server Error');
        });

        it('puts Accept-Language back when i18n-node-yaml throws', () => {
            const { localeMiddleware } = require('../locale');
            const req = { url: '/', headers: { 'accept-language': 'en' }, query: { l: ['en', 'pt'] }, cookies: {} };
            const res = { cookie: jest.fn(), locals: {} };
            expect(() => localeMiddleware({ debug: false })(req, res, jest.fn())).toThrow(TypeError);
            expect(req.headers['accept-language']).toBe('en');
        });
    });
});
