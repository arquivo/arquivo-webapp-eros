'use strict';

// SEC-11 — Open redirect via /switchlang (missing return in referer guard)

jest.mock('../../src/apis/page-search-api');
jest.mock('../../src/apis/image-search-api');
jest.mock('../../src/apis/cdx-api');
jest.mock('../../src/apis/suggestion-api');

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
