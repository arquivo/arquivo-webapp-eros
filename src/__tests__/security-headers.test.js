'use strict';

jest.mock('../../src/apis/page-search-api');
jest.mock('../../src/apis/image-search-api');
jest.mock('../../src/apis/cdx-api');
jest.mock('../../src/apis/suggestion-api');

const request = require('supertest');
const app = require('../../app');

describe('SEC-07 — HTTP security headers', () => {
    let res;

    beforeAll(async () => {
        res = await request(app).get('/');
    });

    it('sets X-Content-Type-Options: nosniff', () => {
        expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('sets X-Frame-Options', () => {
        expect(res.headers['x-frame-options']).toBeDefined();
    });

    it('removes X-Powered-By', () => {
        expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('sets Strict-Transport-Security', () => {
        const hsts = res.headers['strict-transport-security'];
        expect(hsts).toBeDefined();
        expect(hsts).toMatch(/max-age=\d+/);
        expect(hsts).toMatch(/includeSubDomains/i);
    });

    it('sets Content-Security-Policy with object-src none', () => {
        const csp = res.headers['content-security-policy'];
        expect(csp).toBeDefined();
        expect(csp).toMatch(/object-src 'none'/);
    });

    it('sets Content-Security-Policy with frame-ancestors self', () => {
        const csp = res.headers['content-security-policy'];
        expect(csp).toMatch(/frame-ancestors 'self'/);
    });

    it('sets Content-Security-Policy with default-src self', () => {
        const csp = res.headers['content-security-policy'];
        expect(csp).toMatch(/default-src 'self'/);
    });
});
