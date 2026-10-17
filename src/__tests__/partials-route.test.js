'use strict';

// Characterizes GET /partials/:id dispatching: named ids go to their
// handler (with the exact same arguments), an explicit allowlist of generic
// partials is rendered as 'partials/<id>', and every other id (unknown,
// prototype keys, '../' traversal, dotted) falls through to the 404 page
// without the view engine ever being asked to render it (#174).

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

// A dotted id like 'x.foo' makes Express's View require() a module named
// after the extension ('foo') to use as a view engine. This virtual module
// records whether that ever happens for 'x.partials-route-ext-probe'.
const PROBE_EXT = 'partials-route-ext-probe';
const probeLoads = [];
jest.mock('partials-route-ext-probe', () => {
    probeLoads.push(Date.now());
    return {};
}, { virtual: true });

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

    // Spy on the view engine entry point (res.render -> app.render) and
    // return the names of the views it was asked to render.
    async function renderedViews(id) {
        const renderSpy = jest.spyOn(app, 'render');
        try {
            const res = await getPartial(id);
            return { res, views: renderSpy.mock.calls.map(([view]) => view), calls: renderSpy.mock.calls };
        } finally {
            renderSpy.mockRestore();
        }
    }

    it.each(['modal-datepicker', 'modal-image-details'])(
        'renders the allowlisted generic partial %s with layout: false',
        async (id) => {
            const { res, calls } = await renderedViews(id);
            expect(res.status).toBe(200);
            expect(calls).toHaveLength(1);
            expect(calls[0]).toEqual([
                'partials/' + id,
                expect.objectContaining({ layout: false }),
                expect.any(Function),
            ]);
            allHandlers.forEach(h => expect(h).not.toHaveBeenCalled());
        }
    );

    // Every id below must reach the 404 handler, and the only view rendered
    // must be the 404 page: nothing under 'partials/' (or outside views/)
    // is handed to the view engine.
    const expectNotFound = async (id) => {
        const { res, views } = await renderedViews(id);
        expect(res.status).toBe(404);
        expect(views).toEqual(['pages/arquivo-404']);
        allHandlers.forEach(h => expect(h).not.toHaveBeenCalled());
    };

    it.each([
        'does-not-exist',
        // real templates that exist under views/partials/ but are only ever
        // rendered by their own handler, never requested by id
        'url-list-results',
        'url-table-results',
    ])('returns 404 for the non-allowlisted id %s', expectNotFound);

    it.each(['constructor', 'toString', 'hasOwnProperty', '__proto__'])(
        'returns 404 for the prototype key %s',
        expectNotFound
    );

    it.each([
        '..%2Fpages%2Fhome',
        '..%2Ftemplates%2Fhead',
        '..%2F..%2F..%2Ftmp%2Fx',
        '..%5Cpages%5Chome',
        '%2E%2E%2Fpages%2Fhome',
    ])('returns 404 for the traversal id %s', expectNotFound);

    it.each(['x.foo', 'x.config', 'modal-datepicker.ejs', 'modal-datepicker.'])(
        'returns 404 for the dotted id %s',
        expectNotFound
    );

    it('does not require() a module named after a dotted id\'s extension', async () => {
        await expectNotFound('x.' + PROBE_EXT);
        expect(probeLoads).toHaveLength(0);
        expect(app.engines['.' + PROBE_EXT]).toBeUndefined();
    });
});
