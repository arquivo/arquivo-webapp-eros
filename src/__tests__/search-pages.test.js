'use strict';

const http = require('node:http');
const request = require('supertest');
const searchPages = require('../search-pages');

// Mock dependencies
jest.mock('../utils/sanitize-search-params');
jest.mock('../apis/page-search-api');
jest.mock('../export-page-search');
jest.mock('../logger', () => {
    const logger = { info: jest.fn(), error: jest.fn() };
    return jest.fn(() => logger);
});

const sanitizeInputs = require('../utils/sanitize-search-params');
const PageSearchApiRequest = require('../apis/page-search-api');
const makeExportObject = require('../export-page-search');
const loggerFactory = require('../logger');
const logger = loggerFactory();

describe('search-pages handler', () => {
    let req, res;
    let mockRequestData;
    let mockSanitizedRequestData;
    let mockSpellcheckRequestData;
    let mockApiRequest;

    beforeEach(() => {
        jest.clearAllMocks();

        mockRequestData = new URLSearchParams({
            q: 'test query',
            l: 'pt'
        });
        mockRequestData.get = jest.fn((key) => {
            const map = { q: 'test query', l: 'pt', api: 'solr' };
            return map[key];
        });
        mockSpellcheckRequestData = new URLSearchParams({ q: 'test query', fields: 'spellcheck' });

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
                callback({ response_items: [{ title: 'Result 1' }], suggested_query: 'suggested term' });
            }),
            withSpellcheck: jest.fn(() => mockSpellcheckRequestData),
            getSuggestion: jest.fn((apiData, requestData) => apiData.suggested_query || requestData.get('q')),
            sanitizeRequestData: jest.fn(() => mockSanitizedRequestData)
        };
        PageSearchApiRequest.mockImplementation(() => mockApiRequest);

        makeExportObject.mockReturnValue({ export: 'data' });
    });

    it('sanitizes input parameters', () => {
        searchPages(req, res);

        expect(sanitizeInputs).toHaveBeenCalledWith(req, res);
    });

    it('creates PageSearchApiRequest instance', () => {
        searchPages(req, res);

        expect(PageSearchApiRequest).toHaveBeenCalledWith('solr');
    });

    it('requests API with spellcheck added to the sanitized request data', () => {
        searchPages(req, res);

        expect(mockApiRequest.withSpellcheck).toHaveBeenCalledWith(mockRequestData);
        expect(mockApiRequest.get).toHaveBeenCalledWith(
            mockSpellcheckRequestData,
            expect.any(Function)
        );
    });

    it('takes the suggestion from the same API reply as the results', () => {
        searchPages(req, res);

        expect(mockApiRequest.getSuggestion).toHaveBeenCalledWith(
            { response_items: [{ title: 'Result 1' }], suggested_query: 'suggested term' },
            mockRequestData
        );
    });

    it('renders partials/pages-search-results with results data', () => {
        searchPages(req, res);

        expect(res.render).toHaveBeenCalledWith('partials/pages-search-results', {
            requestData: mockRequestData,
            apiData: { response_items: [{ title: 'Result 1' }], suggested_query: 'suggested term' },
            suggestion: 'suggested term',
            exportObject: { export: 'data' }
        });
    });

    it('renders the original query as suggestion when the API has none', () => {
        mockApiRequest.get.mockImplementationOnce((params, callback) => {
            callback({ response_items: [{ title: 'Result 1' }], suggested_query: '' });
        });

        searchPages(req, res);

        expect(res.render).toHaveBeenCalledWith('partials/pages-search-results', expect.objectContaining({
            suggestion: 'test query'
        }));
    });

    it('creates export object with the request data without spellcheck', () => {
        searchPages(req, res);

        expect(mockApiRequest.sanitizeRequestData).toHaveBeenCalledWith(mockRequestData);
        expect(makeExportObject).toHaveBeenCalledWith(
            mockSanitizedRequestData,
            { response_items: [{ title: 'Result 1' }], suggested_query: 'suggested term' },
            req.t
        );
    });

    it('handles empty results from API', () => {
        mockApiRequest.get.mockImplementationOnce((params, callback) => {
            callback({ response_items: [], suggested_query: 'suggested term' });
        });

        searchPages(req, res);

        expect(res.render).toHaveBeenCalledWith('partials/pages-search-results', {
            requestData: mockRequestData,
            apiData: { response_items: [], suggested_query: 'suggested term' },
            suggestion: 'suggested term',
            exportObject: { export: 'data' }
        });
    });

    it('handles null response_items from API', () => {
        mockApiRequest.get.mockImplementationOnce((params, callback) => {
            callback({ response_items: null });
        });

        searchPages(req, res);

        expect(res.render).toHaveBeenCalled();
    });

    it('logs under the PageSearch label', () => {
        // Load the handler in a fresh module registry, so the logger factory call doesn't depend on require order
        jest.isolateModules(() => {
            const isolatedLoggerFactory = require('../logger');
            require('../search-pages');
            expect(isolatedLoggerFactory).toHaveBeenCalledWith('PageSearch');
        });
    });

    it('does not log a no-results message when response_items has results', () => {
        searchPages(req, res);

        expect(logger.info).not.toHaveBeenCalled();
    });

    it('logs a no-results message when response_items is empty', () => {
        mockApiRequest.get.mockImplementationOnce((params, callback) => {
            callback({ response_items: [] });
        });

        searchPages(req, res);

        expect(logger.info).toHaveBeenCalledWith('No results found for the following query: "test query"');
    });

    it('logs a no-results message when the reply only has the image search responseItems key', () => {
        mockApiRequest.get.mockImplementationOnce((params, callback) => {
            callback({ responseItems: [{ title: 'Image 1' }] });
        });

        searchPages(req, res);

        expect(logger.info).toHaveBeenCalledWith('No results found for the following query: "test query"');
    });

    it('renders synchronously in the API callback', () => {
        searchPages(req, res);

        expect(res.render).toHaveBeenCalledTimes(1);
    });

    it('passes render errors to next instead of throwing them from the API callback', () => {
        const next = jest.fn();
        const error = new Error('render failed');
        res.render.mockImplementationOnce(() => { throw error; });

        expect(() => searchPages(req, res, next)).not.toThrow();
        expect(next).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledWith(error);
    });

    it('passes suggestion errors to next without rendering', () => {
        const next = jest.fn();
        const error = new Error('suggestion failed');
        mockApiRequest.getSuggestion.mockImplementationOnce(() => { throw error; });

        expect(() => searchPages(req, res, next)).not.toThrow();
        expect(next).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledWith(error);
        expect(res.render).not.toHaveBeenCalled();
    });

    it('does not call next when the render succeeds', () => {
        const next = jest.fn();

        searchPages(req, res, next);

        expect(next).not.toHaveBeenCalled();
    });
});

describe('GET /partials/pages-search-results when the API callback throws', () => {
    let app;
    let stubServer;
    let stubStatus;
    let stubBody;
    const error = new Error('export failed');

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
        // The real request flow and API client (with its success and fallback paths); only the
        // API is a stub, and the export throws inside the API callback
        sanitizeInputs.mockImplementation(jest.requireActual('../utils/sanitize-search-params'));
        makeExportObject.mockImplementation(() => { throw error; });
        const ActualPageSearchApiRequest = jest.requireActual('../apis/page-search-api');
        PageSearchApiRequest.mockImplementation((backend) => {
            const api = new ActualPageSearchApiRequest(backend);
            api.apiUrl = `http://localhost:${stubServer.address().port}`;
            return api;
        });
    });

    it.each([
        ['a 2xx status', 200, JSON.stringify({ response_items: [] })],
        ['a non-2xx status', 503, JSON.stringify({ error: 'unavailable' })],
    ])('replies with an error, instead of hanging or crashing, when the API replies %s', async (_name, status, body) => {
        stubStatus = status;
        stubBody = body;

        const res = await request(app).get('/partials/pages-search-results?q=test').timeout(5000);

        expect(res.status).toBe(500);
        expect(makeExportObject).toHaveBeenCalledTimes(1);
        // Not swallowed and logged as a JSON parse error by the API client
        expect(logger.error).not.toHaveBeenCalledWith(expect.stringContaining('JSON parse error'));
    });
});
