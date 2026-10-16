'use strict';

const searchImages = require('../search-images');

// Mock dependencies
jest.mock('../utils/sanitize-search-params');
jest.mock('../apis/image-search-api');
jest.mock('../apis/page-search-api');
jest.mock('../export-image-search');
jest.mock('../logger', () => {
    const logger = { info: jest.fn() };
    return jest.fn(() => logger);
});

const sanitizeInputs = require('../utils/sanitize-search-params');
const ImageSearchApiRequest = require('../apis/image-search-api');
const PageSearchApiRequest = require('../apis/page-search-api');
const makeExportObject = require('../export-image-search');
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
            const map = { q: 'test query', l: 'pt', api: 'solr' };
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

    it('creates ImageSearchApiRequest instance, ignoring the api parameter', () => {
        searchImages(req, res);

        expect(ImageSearchApiRequest).toHaveBeenCalledWith();
    });

    it('creates a default-backend PageSearchApiRequest with a short timeout for the suggestion', () => {
        searchImages(req, res);

        expect(PageSearchApiRequest).toHaveBeenCalledWith(null, { timeout: 3000 });
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

        expect(logger.info).toHaveBeenCalledWith('No results found for the following query: "test query"');
    });

    it('logs a no-results message when the reply only has the page search response_items key', async () => {
        mockApiRequest.get.mockImplementationOnce((params, callback) => {
            callback({ response_items: [{ title: 'Result 1' }] });
        });

        searchImages(req, res);
        await flushPromises();

        expect(logger.info).toHaveBeenCalledWith('No results found for the following query: "test query"');
    });

    it('renders asynchronously, after both requests resolve', async () => {
        searchImages(req, res);
        expect(res.render).not.toHaveBeenCalled();

        await flushPromises();
        expect(res.render).toHaveBeenCalledTimes(1);
    });
});
