'use strict';

// Characterizes GET /partials/:id dispatching: named ids go to their
// handler (with the exact same arguments), anything else falls back to
// rendering the generic 'partials/<id>' template.

jest.mock('../../src/apis/page-search-api');
jest.mock('../../src/apis/image-search-api');
jest.mock('../../src/apis/cdx-api');
jest.mock('../../src/apis/suggestion-api');

// Replace the partial handlers with stubs that just identify themselves
jest.mock('../search-pages', () => jest.fn((req, res) => res.send('search-pages')));
jest.mock('../search-images', () => jest.fn((req, res) => res.send('search-images')));
jest.mock('../search-url', () => jest.fn((req, res) => res.send('search-url')));
jest.mock('../replay-nav', () => jest.fn((req, res) => res.send('replay-nav')));
jest.mock('../replay-technical-details', () => jest.fn((req, res) => res.send('replay-technical-details')));

const request = require('supertest');
const searchPages = require('../search-pages');
const searchImages = require('../search-images');
const searchUrl = require('../search-url');
const replayNav = require('../replay-nav');
const replayTechnicalDetails = require('../replay-technical-details');
const app = require('../../app');

const handlers = {
    'pages-search-results': searchPages,
    'images-search-results': searchImages,
    'url-search-results': searchUrl,
    'replay-nav': replayNav,
    'replay-technical-details': replayTechnicalDetails,
};
const allHandlers = Object.values(handlers);

beforeEach(() => {
    jest.clearAllMocks();
});

describe('GET /partials/:id', () => {

    describe.each(Object.entries(handlers))('named partial %s', (id, handler) => {
        it('dispatches to its handler only', async () => {
            const res = await request(app).get('/partials/' + id);
            expect(res.status).toBe(200);
            expect(handler).toHaveBeenCalledTimes(1);
            allHandlers
                .filter(h => h !== handler)
                .forEach(h => expect(h).not.toHaveBeenCalled());
        });

        it('passes the request params through to the handler', async () => {
            await request(app).get('/partials/' + id);
            const [req, res] = handler.mock.calls[0];
            expect(req.params.id).toBe(id);
            expect(typeof res.render).toBe('function');
        });
    });

    it('calls searchImages with (req, res, next)', async () => {
        await request(app).get('/partials/images-search-results');
        const args = searchImages.mock.calls[0];
        expect(args).toHaveLength(3);
        expect(typeof args[2]).toBe('function');
    });

    it.each([
        'pages-search-results',
        'url-search-results',
        'replay-nav',
        'replay-technical-details',
    ])('calls the %s handler with only (req, res)', async (id) => {
        await request(app).get('/partials/' + id);
        expect(handlers[id].mock.calls[0]).toHaveLength(2);
    });

    it('renders an existing generic partial template without a layout', async () => {
        const res = await request(app).get('/partials/modal-datepicker');
        expect(res.status).toBe(200);
        expect(res.text).not.toMatch(/<html/i);
        allHandlers.forEach(h => expect(h).not.toHaveBeenCalled());
    });

    it('falls back to the generic render for an unknown id (missing template)', async () => {
        const res = await request(app).get('/partials/does-not-exist');
        expect(res.status).toBe(500);
        allHandlers.forEach(h => expect(h).not.toHaveBeenCalled());
    });

    it.each(['constructor', 'toString', 'hasOwnProperty', '__proto__'])(
        'treats the prototype key %s as a generic partial, not a handler',
        async (id) => {
            const res = await request(app).get('/partials/' + id);
            expect(res.status).toBe(500);
            expect(res.text).toContain('partials/' + id);
            allHandlers.forEach(h => expect(h).not.toHaveBeenCalled());
        }
    );
});
