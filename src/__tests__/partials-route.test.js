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

// Fail fast instead of hanging Jest if a request never gets a response
// (e.g. a plain-object lookup calling Object() for 'constructor')
const REQUEST_TIMEOUT_MS = 2000;
const getPartial = (id) => request(app).get('/partials/' + id).timeout(REQUEST_TIMEOUT_MS);

beforeEach(() => {
    jest.clearAllMocks();
});

describe('GET /partials/:id', () => {

    it.each(Object.entries(handlers))('dispatches %s to its handler only', async (id, handler) => {
        const res = await getPartial(id);
        expect(res.status).toBe(200);
        expect(handler).toHaveBeenCalledTimes(1);
        const [req, response] = handler.mock.calls[0];
        expect(req.params.id).toBe(id);
        expect(typeof response.render).toBe('function');
        allHandlers
            .filter(h => h !== handler)
            .forEach(h => expect(h).not.toHaveBeenCalled());
    });

    it('calls searchImages with (req, res, next)', async () => {
        await getPartial('images-search-results');
        const args = searchImages.mock.calls[0];
        expect(args).toHaveLength(3);
        expect(typeof args[2]).toBe('function');
    });

    it('renders an existing generic partial template with layout: false', async () => {
        const renderSpy = jest.spyOn(app, 'render');
        try {
            const res = await getPartial('modal-datepicker');
            expect(res.status).toBe(200);
            expect(renderSpy).toHaveBeenCalledWith(
                'partials/modal-datepicker',
                expect.objectContaining({ layout: false }),
                expect.any(Function)
            );
            allHandlers.forEach(h => expect(h).not.toHaveBeenCalled());
        } finally {
            renderSpy.mockRestore();
        }
    });

    it('falls back to the generic render for an unknown id (missing template)', async () => {
        const res = await getPartial('does-not-exist');
        expect(res.status).toBe(500);
        allHandlers.forEach(h => expect(h).not.toHaveBeenCalled());
    });

    it.each(['constructor', 'toString', 'hasOwnProperty', '__proto__'])(
        'treats the prototype key %s as a generic partial, not a handler',
        async (id) => {
            const res = await getPartial(id);
            expect(res.status).toBe(500);
            allHandlers.forEach(h => expect(h).not.toHaveBeenCalled());
        }
    );
});
