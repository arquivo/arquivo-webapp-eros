'use strict';

const request = require('supertest');

// Mock API modules before app is loaded
jest.mock('../../src/apis/page-search-api');
jest.mock('../../src/apis/image-search-api');
jest.mock('../../src/apis/cdx-api');
jest.mock('../../src/apis/suggestion-api');

const PageSearchApiRequest = require('../../src/apis/page-search-api');
const ImageSearchApiRequest = require('../../src/apis/image-search-api');
const CDXSearchApiRequest = require('../../src/apis/cdx-api');
const SuggestionApi = require('../../src/apis/suggestion-api');

PageSearchApiRequest.mockImplementation(() => ({
    get: (_data, cb) => cb({ estimated_nr_results: 0, response_items: [] }),
    sanitizeRequestData: (data) => data,
}));

ImageSearchApiRequest.mockImplementation(() => ({
    get: (_data, cb) => cb({ responseItems: [] }),
    sanitizeRequestData: (data) => data,
}));

CDXSearchApiRequest.mockImplementation(() => ({
    get: (_data, cb) => cb([]),
    sanitizeRequestData: (data) => data,
}));

SuggestionApi.mockImplementation(() => ({
    getSuggestion: (_query, _lang, cb) => cb(null),
}));

const app = require('../../app');

describe('Static Assets Smoke Test', () => {
    describe('GET /vendor/css/', () => {
        it('serves fontawesome-all.min.css with 200 status', async () => {
            const res = await request(app)
                .get('/vendor/css/fontawesome-all.min.css');
            expect(res.status).toBe(200);
        });
    });

    describe('GET /css/', () => {
        it('serves styles.css with 200 status', async () => {
            const res = await request(app)
                .get('/css/styles.css');
            expect(res.status).toBe(200);
        });

        it('serves styles-home.css with 200 status', async () => {
            const res = await request(app)
                .get('/css/styles-home.css');
            expect(res.status).toBe(200);
        });

        it('serves reset.css with 200 status', async () => {
            const res = await request(app)
                .get('/css/reset.css');
            expect(res.status).toBe(200);
        });
    });

    describe('GET /js/', () => {
        it('serves init.js with 200 status', async () => {
            const res = await request(app)
                .get('/js/init.js');
            expect(res.status).toBe(200);
        });

        it('serves functions.js with 200 status', async () => {
            const res = await request(app)
                .get('/js/functions.js');
            expect(res.status).toBe(200);
        });

        it('serves exports.js with 200 status', async () => {
            const res = await request(app)
                .get('/js/exports.js');
            expect(res.status).toBe(200);
        });
    });

    describe('Non-existent assets', () => {
        it('returns 404 for missing CSS file', async () => {
            const res = await request(app)
                .get('/css/nonexistent.css');
            expect(res.status).toBe(404);
        });

        it('returns 404 for missing JS file', async () => {
            const res = await request(app)
                .get('/js/nonexistent.js');
            expect(res.status).toBe(404);
        });
    });
});
