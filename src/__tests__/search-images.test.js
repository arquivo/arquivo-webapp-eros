'use strict';

const searchImages = require('../search-images');

// Mock dependencies
jest.mock('../utils/sanitize-search-params');
jest.mock('../apis/image-search-api');
jest.mock('../apis/suggestion-api');
jest.mock('../export-image-search');

const sanitizeInputs = require('../utils/sanitize-search-params');
const ImageSearchApiRequest = require('../apis/image-search-api');
const SuggestionApi = require('../apis/suggestion-api');
const makeExportObject = require('../export-image-search');

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
            getSuggestion: jest.fn((query, lang, callback) => {
                callback('suggested term');
            })
        };
        SuggestionApi.mockImplementation(() => mockSuggestionRequest);

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

    it('creates SuggestionApi instance', () => {
        searchImages(req, res);

        expect(SuggestionApi).toHaveBeenCalled();
    });

    it('requests suggestion with query and language', () => {
        searchImages(req, res);

        expect(mockSuggestionRequest.getSuggestion).toHaveBeenCalledWith(
            'test query',
            'pt',
            expect.any(Function)
        );
    });

    it('requests API with sanitized request data', () => {
        searchImages(req, res);

        expect(mockApiRequest.get).toHaveBeenCalledWith(
            mockRequestData,
            expect.any(Function)
        );
    });

    it('renders partials/images-search-results with results data', () => {
        searchImages(req, res);

        expect(res.render).toHaveBeenCalledWith('partials/images-search-results', {
            requestData: mockRequestData,
            apiData: { responseItems: [{ title: 'Image 1' }] },
            suggestion: 'suggested term',
            exportObject: { export: 'image data' }
        });
    });

    it('creates export object with sanitized request data', () => {
        searchImages(req, res);

        expect(makeExportObject).toHaveBeenCalledWith(
            mockRequestData,
            { responseItems: [{ title: 'Image 1' }] },
            req.t
        );
    });

    it('handles empty results from API', () => {
        mockApiRequest.get.mockImplementationOnce((params, callback) => {
            callback({ responseItems: [] });
        });

        searchImages(req, res);

        expect(res.render).toHaveBeenCalledWith('partials/images-search-results', {
            requestData: mockRequestData,
            apiData: { responseItems: [] },
            suggestion: 'suggested term',
            exportObject: { export: 'image data' }
        });
    });

    it('handles null responseItems from API', () => {
        mockApiRequest.get.mockImplementationOnce((params, callback) => {
            callback({ responseItems: null });
        });

        searchImages(req, res);

        expect(res.render).toHaveBeenCalled();
    });

    it('uses default language when language is not provided', () => {
        mockRequestData.get = jest.fn((key) => {
            const map = { q: 'test query', l: undefined };
            return map[key];
        });
        sanitizeInputs.mockReturnValue(mockRequestData);

        searchImages(req, res);

        expect(mockSuggestionRequest.getSuggestion).toHaveBeenCalledWith(
            'test query',
            'pt',
            expect.any(Function)
        );
    });
});
