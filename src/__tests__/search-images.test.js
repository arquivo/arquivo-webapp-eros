'use strict';

const http = require('node:http');
const request = require('supertest');
const searchImages = require('../search-images');

// Mock dependencies
jest.mock('../utils/sanitize-search-params');
jest.mock('../apis/image-search-api');
jest.mock('../apis/page-search-api');
jest.mock('../export-image-search');
jest.mock('../logger', () => {
    const logger = { info: jest.fn(), error: jest.fn(), debug: jest.fn() };
    return jest.fn(() => logger);
});

const sanitizeInputs = require('../utils/sanitize-search-params');
const ImageSearchApiRequest = require('../apis/image-search-api');
const PageSearchApiRequest = require('../apis/page-search-api');
const makeExportObject = require('../export-image-search');
const todayYmd = require('../utils/today-ymd');
const loggerFactory = require('../logger');
const logger = loggerFactory();

// The handler renders once both API calls have resolved (Promise.all)
const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('search-images handler', () => {
    let req, res;
    let mockRequestData;
    let mockSanitizedRequestData;
    let mockApiRequest;
    let mockSuggestionRequest;

    beforeEach(() => {
        jest.clearAllMocks();

        mockRequestData = new URLSearchParams({
            q: 'test query',
            l: 'pt'
        });
        mockRequestData.get = jest.fn((key) => {
            const map = { q: 'test query', l: 'pt' };
            return map[key];
        });

        mockSanitizedRequestData = new URLSearchParams({ q: 'test query' });

        req = {
            t: jest.fn((key) => key)
        };

        res = {
            render: jest.fn()
        };

        sanitizeInputs.mockReturnValue(mockRequestData);

        mockApiRequest = {
            get: jest.fn((params, callback) => {
                callback({ responseItems: [{ title: 'Image 1' }] });
            }),
            sanitizeRequestData: jest.fn(() => mockSanitizedRequestData)
        };
        ImageSearchApiRequest.mockImplementation(() => mockApiRequest);

        mockSuggestionRequest = {
            suggest: jest.fn((requestData, callback) => {
                callback('suggested term');
            })
        };
        PageSearchApiRequest.mockImplementation(() => mockSuggestionRequest);

        makeExportObject.mockReturnValue({ export: 'image data' });
    });

    it('sanitizes input parameters', () => {
        searchImages(req, res);

        expect(sanitizeInputs).toHaveBeenCalledWith(req, res);
    });

    it('creates ImageSearchApiRequest instance', () => {
        searchImages(req, res);

        expect(ImageSearchApiRequest).toHaveBeenCalledWith();
    });

    it('creates a PageSearchApiRequest with a short timeout for the suggestion', () => {
        searchImages(req, res);

        expect(PageSearchApiRequest).toHaveBeenCalledWith({ timeout: 3000 });
    });

    it('requests the suggestion and the images in parallel', () => {
        mockSuggestionRequest.suggest.mockImplementationOnce(() => {});
        mockApiRequest.get.mockImplementationOnce(() => {});

        searchImages(req, res);

        expect(mockSuggestionRequest.suggest).toHaveBeenCalledWith(mockRequestData, expect.any(Function));
        expect(mockApiRequest.get).toHaveBeenCalledWith(mockRequestData, expect.any(Function));
    });

    it('waits for both the suggestion and the images before rendering', async () => {
        let resolveSuggestion;
        mockSuggestionRequest.suggest.mockImplementationOnce((requestData, callback) => {
            resolveSuggestion = callback;
        });

        searchImages(req, res);
        await flushPromises();
        expect(res.render).not.toHaveBeenCalled();

        resolveSuggestion('late suggestion');
        await flushPromises();
        expect(res.render).toHaveBeenCalledWith('partials/images-search-results', expect.objectContaining({
            suggestion: 'late suggestion'
        }));
    });

    it('renders partials/images-search-results with results data', async () => {
        searchImages(req, res);
        await flushPromises();

        expect(res.render).toHaveBeenCalledWith('partials/images-search-results', {
            requestData: mockRequestData,
            apiData: { responseItems: [{ title: 'Image 1' }] },
            suggestion: 'suggested term',
            exportObject: { export: 'image data' }
        });
    });

    it('creates export object with sanitized request data', async () => {
        searchImages(req, res);
        await flushPromises();

        expect(mockApiRequest.sanitizeRequestData).toHaveBeenCalledWith(mockRequestData);
        expect(makeExportObject).toHaveBeenCalledWith(
            mockSanitizedRequestData,
            { responseItems: [{ title: 'Image 1' }] },
            req.t
        );
    });

    it('handles empty results from API', async () => {
        mockApiRequest.get.mockImplementationOnce((params, callback) => {
            callback({ responseItems: [] });
        });

        searchImages(req, res);
        await flushPromises();

        expect(res.render).toHaveBeenCalledWith('partials/images-search-results', {
            requestData: mockRequestData,
            apiData: { responseItems: [] },
            suggestion: 'suggested term',
            exportObject: { export: 'image data' }
        });
    });

    it('passes errors to the express error handler instead of hanging the request', async () => {
        const next = jest.fn();
        const error = new Error('render failed');
        res.render.mockImplementationOnce(() => { throw error; });

        searchImages(req, res, next);
        await flushPromises();

        expect(next).toHaveBeenCalledWith(error);
    });

    it('handles null responseItems from API', async () => {
        mockApiRequest.get.mockImplementationOnce((params, callback) => {
            callback({ responseItems: null });
        });

        searchImages(req, res);
        await flushPromises();

        expect(res.render).toHaveBeenCalled();
    });

    it('logs under the ImageSearch label', () => {
        // Load the handler in a fresh module registry, so the logger factory call doesn't depend on require order
        jest.isolateModules(() => {
            const isolatedLoggerFactory = require('../logger');
            require('../search-images');
            expect(isolatedLoggerFactory).toHaveBeenCalledWith('ImageSearch');
        });
    });

    it('does not log a no-results message when responseItems has results', async () => {
        searchImages(req, res);
        await flushPromises();

        expect(logger.info).not.toHaveBeenCalled();
    });

    it('logs a no-results message when responseItems is empty', async () => {
        mockApiRequest.get.mockImplementationOnce((params, callback) => {
            callback({ responseItems: [] });
        });

        searchImages(req, res);
        await flushPromises();

        expect(logger.info).toHaveBeenCalledWith('No results found for a query of 10 characters');
    });

    it('logs a no-results message when the reply only has the page search response_items key', async () => {
        mockApiRequest.get.mockImplementationOnce((params, callback) => {
            callback({ response_items: [{ title: 'Result 1' }] });
        });

        searchImages(req, res);
        await flushPromises();

        expect(logger.info).toHaveBeenCalledWith('No results found for a query of 10 characters');
    });

    it('renders asynchronously, after both requests resolve', async () => {
        searchImages(req, res);
        expect(res.render).not.toHaveBeenCalled();

        await flushPromises();
        expect(res.render).toHaveBeenCalledTimes(1);
    });
});

describe('GET /partials/images-search-results when the image search API fails', () => {
    let app;
    let stubServer;
    let stubStatus;
    let stubBody;

    beforeAll((done) => {
        app = require('../../app');
        stubServer = http.createServer((req, res) => {
            res.writeHead(stubStatus, { 'Content-Type': 'application/json' });
            res.end(stubBody);
        });
        stubServer.listen(0, done);
    });

    afterAll((done) => {
        stubServer.close(done);
    });

    beforeEach(() => {
        jest.clearAllMocks();
        // The real request flow, API client, fallback reply, template and export; only the API is a stub
        sanitizeInputs.mockImplementation(jest.requireActual('../utils/sanitize-search-params'));
        makeExportObject.mockImplementation(jest.requireActual('../export-image-search'));
        const ActualImageSearchApiRequest = jest.requireActual('../apis/image-search-api');
        ImageSearchApiRequest.mockImplementation(() => {
            const api = new ActualImageSearchApiRequest();
            api.apiUrl = `http://localhost:${stubServer.address().port}`;
            return api;
        });
        PageSearchApiRequest.mockImplementation(() => ({
            suggest: (requestData, callback) => callback(requestData.get('q')),
        }));
    });

    const expectNotFound = async () => {
        const res = await request(app).get('/partials/images-search-results?q=test').timeout(5000);

        expect(res.status).toBe(200);
        expect(res.text).toContain('id="not-found-container"');
        expect(res.text).not.toContain('image-cards-container');
        expect(makeExportObject).toHaveBeenCalledWith(
            expect.any(URLSearchParams), { totalItems: 0, responseItems: [] }, expect.any(Function)
        );
    };

    it.each([
        ['a non-2xx status', 503, JSON.stringify({ error: 'unavailable' })],
        ['{}', 200, '{}'],
        ['null', 200, 'null'],
    ])('renders the not found body when the API replies %s', async (_name, status, body) => {
        stubStatus = status;
        stubBody = body;

        await expectNotFound();
    });
});

describe('query string sent to the image search API', () => {
    let app;
    let stubServer;
    let captured;

    beforeAll((done) => {
        app = require('../../app');
        stubServer = http.createServer((req, res) => {
            captured.push(new URL(req.url, 'http://localhost').search.slice(1));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ totalItems: 0, responseItems: [] }));
        });
        stubServer.listen(0, done);
    });

    afterAll((done) => {
        stubServer.close(done);
    });

    beforeEach(() => {
        jest.clearAllMocks();
        captured = [];
        sanitizeInputs.mockImplementation(jest.requireActual('../utils/sanitize-search-params'));
        makeExportObject.mockImplementation(jest.requireActual('../export-image-search'));
        const ActualImageSearchApiRequest = jest.requireActual('../apis/image-search-api');
        ImageSearchApiRequest.mockImplementation(() => {
            const api = new ActualImageSearchApiRequest();
            api.apiUrl = `http://localhost:${stubServer.address().port}`;
            return api;
        });
        PageSearchApiRequest.mockImplementation(() => ({
            suggest: (requestData, callback) => callback(''),
        }));
    });

    // The query string of the results partial, as the results page's loading form sends it
    const loadingFormQuery = (html) => {
        const form = html.match(/<form id="loading-form"[^>]*>([\s\S]*?)<\/form>/)[1];
        const decode = (value) => value.replace(/&(#34|#39|lt|gt|amp);/g, (_entity, name) =>
            ({ '#34': '"', '#39': "'", lt: '<', gt: '>', amp: '&' })[name]);
        return new URLSearchParams([...form.matchAll(/<input type="hidden" name="([^"]*)" value="([^"]*)">/g)]
            .map(([, name, value]) => [decode(name), decode(value)]));
    };

    // What the browser sends to the API for a query typed in the search box
    const apiQueryFor = async (q) => {
        const page = await request(app).get('/image/search').query({ q }).timeout(5000);
        expect(page.status).toBe(200);
        const partial = await request(app).get('/partials/images-search-results?' + loadingFormQuery(page.text)).timeout(5000);
        expect(partial.status).toBe(200);
        expect(captured).toHaveLength(1);
        return captured[0];
    };

    const expectedApiQuery = (params) => {
        const defaults = new (jest.requireActual('../apis/image-search-api'))().defaultApiParams;
        return new URLSearchParams([
            ['q', params.q],
            ['from', '19910806'],
            ['to', todayYmd()],
            ...(params.type ? [['type', params.type]] : []),
            ['offset', '0'],
            ['siteSearch', params.siteSearch],
            ['maxItems', '25'],
            ['fields', defaults.fields],
            ['prettyPrint', 'false'],
            ['size', params.size ?? 'all'],
            ['safeSearch', params.safeSearch ?? 'on'],
        ]).toString();
    };

    it('sends the site, type, safe and size terms in their own parameters, and only the text in q', async () => {
        expect(await apiQueryFor('farol site:publico.pt type:png safe:off size:lg')).toBe(expectedApiQuery({
            q: 'farol', type: 'png', siteSearch: 'publico.pt', size: 'lg', safeSearch: 'off',
        }));
    });

    it('keeps the exact phrase and the exclusion in q, and sends the wildcard site in siteSearch', async () => {
        expect(await apiQueryFor('"exact phrase" -excluded site:*.sapo.pt')).toBe(expectedApiQuery({
            q: '"exact phrase" -excluded', siteSearch: '*.sapo.pt',
        }));
    });

    it('sends a URL typed as the query in siteSearch, with an empty q', async () => {
        expect(await apiQueryFor('publico.pt')).toBe(expectedApiQuery({ q: '', siteSearch: 'publico.pt' }));
    });
});
