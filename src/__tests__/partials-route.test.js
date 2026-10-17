'use strict';

// Characterizes GET /partials/:id dispatching: named ids go to their
// handler (with the exact same arguments), the two modal partials render
// their own template, and every other id (unknown, case variants, prototype
// keys, '../' traversal, dotted) falls through to the 404 page without the
// view engine ever being asked to render it (#174).

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

    // Request the partial while spying on the view engine entry point
    // (res.render -> app.render) and return the app.render calls made.
    async function getPartialWithRenderCalls(id) {
        const renderSpy = jest.spyOn(app, 'render');
        try {
            const res = await getPartial(id);
            return { res, renderCalls: renderSpy.mock.calls };
        } finally {
            renderSpy.mockRestore();
        }
    }

    it.each(['modal-datepicker', 'modal-image-details'])(
        'renders the modal partial %s with layout: false',
        async (id) => {
            const { res, renderCalls } = await getPartialWithRenderCalls(id);
            expect(res.status).toBe(200);
            expect(renderCalls).toEqual([[
                'partials/' + id,
                expect.objectContaining({ layout: false }),
                expect.any(Function),
            ]]);
            allHandlers.forEach(h => expect(h).not.toHaveBeenCalled());
        }
    );

    // Every id below must reach the 404 handler, and the only view rendered
    // must be the 404 page: nothing under 'partials/' (or outside views/)
    // is handed to the view engine. Express only require()s a view engine
    // from inside app.render, so this also proves that a dotted id never
    // loads a module named after its extension.
    // One id per category: with an allowlist, every other id of the same
    // kind takes the same path.
    it.each([
        ['an unknown id', 'does-not-exist'],
        // a real template under views/partials/ that only its own handler
        // (url-search-results) renders; it is never requested by id
        ['a template that is not allowlisted', 'url-list-results'],
        // ids are matched exactly
        ['an upper-case modal partial id', 'MODAL-DATEPICKER'],
        ['an upper-case handler id', 'REPLAY-NAV'],
        ['a prototype key', 'constructor'],
        ['a traversal id', '..%2Fpages%2Fhome'],
        // a real id plus a suffix: no prefix match or stripping after the dot;
        // it also used to make Express require('config') as a view engine
        ['a dotted id', 'modal-datepicker.config'],
    ])('returns 404 for %s: %s', async (_category, id) => {
        const { res, renderCalls } = await getPartialWithRenderCalls(id);
        expect(res.status).toBe(404);
        expect(renderCalls.map(([view]) => view)).toEqual(['pages/arquivo-404']);
        allHandlers.forEach(h => expect(h).not.toHaveBeenCalled());
    });
});
