'use strict';

const searchImages = require('../search-images');

// Mock dependencies
jest.mock('../utils/sanitize-search-params');
jest.mock('../apis/image-search-api');
jest.mock('../apis/page-search-api');
jest.mock('../export-image-search');

const sanitizeInputs = require('../utils/sanitize-search-params');
const ImageSearchApiRequest = require('../apis/image-search-api');
const PageSearchApiRequest = require('../apis/page-search-api');
const makeExportObject = require('../export-image-search');

// The handler renders once both API calls have resolved (Promise.all)
const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('search-images handler', () => {
    let req, res;
    let mockRequestData;
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
            sanitizeRequestData: jest.fn((data) => data)
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

        expect(ImageSearchApiRequest).toHaveBeenCalled();
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

        expect(makeExportObject).toHaveBeenCalledWith(
            mockRequestData,
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
});
