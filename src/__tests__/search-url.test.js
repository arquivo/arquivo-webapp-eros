'use strict';

const searchUrl = require('../search-url');

// Mock dependencies
jest.mock('../utils/sanitize-search-params');
jest.mock('../apis/cdx-api');
jest.mock('../filter-cdx');
jest.mock('../apis/suggestion-api');

const sanitizeInputs = require('../utils/sanitize-search-params');
const CDXSearchApiRequest = require('../apis/cdx-api');
const cdxFilter = require('../filter-cdx');
const SuggestionApi = require('../apis/suggestion-api');

describe('search-url handler', () => {
    let req, res;
    let mockRequestData;
    let mockApiRequest;
    let mockSuggestionRequest;

    beforeEach(() => {
        jest.clearAllMocks();

        mockRequestData = new URLSearchParams({
            q: 'example.com',
            l: 'pt',
            viewMode: 'list'
        });
        mockRequestData.get = jest.fn((key) => {
            const map = { q: 'example.com', l: 'pt', viewMode: 'list' };
            return map[key];
        });
        mockRequestData.set = jest.fn();

        req = {
            t: jest.fn((key) => key)
        };

        res = {
            render: jest.fn()
        };

        sanitizeInputs.mockReturnValue(mockRequestData);

        mockApiRequest = {
            get: jest.fn((params, callback) => {
                callback([{ url: 'example.com', timestamp: '20230101120000', status: '200' }]);
            })
        };
        CDXSearchApiRequest.mockImplementation(() => mockApiRequest);

        mockSuggestionRequest = {
            getSuggestion: jest.fn((query, lang, callback) => {
                callback('suggested.com');
            })
        };
        SuggestionApi.mockImplementation(() => mockSuggestionRequest);

        cdxFilter.mockImplementation((data) => data);
    });

    it('creates CDXSearchApiRequest instance', () => {
        searchUrl(req, res);

        expect(CDXSearchApiRequest).toHaveBeenCalled();
    });

    it('creates SuggestionApi instance', () => {
        searchUrl(req, res);

        expect(SuggestionApi).toHaveBeenCalled();
    });

    it('sanitizes input parameters', () => {
        searchUrl(req, res);

        expect(sanitizeInputs).toHaveBeenCalledWith(req, res);
    });

    it('uses default viewMode "list" when not provided', () => {
        mockRequestData.get = jest.fn((key) => {
            const map = { q: 'example.com', l: 'pt', viewMode: undefined };
            return map[key];
        });
        sanitizeInputs.mockReturnValue(mockRequestData);

        searchUrl(req, res);

        expect(res.render).toHaveBeenCalledWith(
            'partials/url-list-results',
            expect.any(Object)
        );
    });

    it('renders url-table-results when viewMode is "table"', () => {
        mockRequestData.get = jest.fn((key) => {
            const map = { q: 'example.com', l: 'pt', viewMode: 'table' };
            return map[key];
        });
        sanitizeInputs.mockReturnValue(mockRequestData);

        searchUrl(req, res);

        expect(res.render).toHaveBeenCalledWith(
            'partials/url-table-results',
            expect.any(Object)
        );
    });

    it('defaults to list view when invalid viewMode is provided', () => {
        mockRequestData.get = jest.fn((key) => {
            const map = { q: 'example.com', l: 'pt', viewMode: 'invalid' };
            return map[key];
        });
        sanitizeInputs.mockReturnValue(mockRequestData);

        searchUrl(req, res);

        expect(res.render).toHaveBeenCalledWith(
            'partials/url-list-results',
            expect.any(Object)
        );
    });

    it('filters API data before rendering', () => {
        searchUrl(req, res);

        expect(cdxFilter).toHaveBeenCalledWith([
            { url: 'example.com', timestamp: '20230101120000', status: '200' }
        ]);
    });

    it('renders with filtered data', () => {
        const filteredData = [{ url: 'example.com', timestamp: '20230101120000', status: '200' }];
        cdxFilter.mockReturnValue(filteredData);

        searchUrl(req, res);

        expect(res.render).toHaveBeenCalledWith(
            'partials/url-list-results',
            expect.objectContaining({
                apiData: filteredData
            })
        );
    });

    it('requests suggestion with query and language', () => {
        searchUrl(req, res);

        expect(mockSuggestionRequest.getSuggestion).toHaveBeenCalledWith(
            'example.com',
            'pt',
            expect.any(Function)
        );
    });

    it('requests API with request data', () => {
        searchUrl(req, res);

        expect(mockApiRequest.get).toHaveBeenCalledWith(
            mockRequestData,
            expect.any(Function)
        );
    });

    it('passes requestData to render', () => {
        searchUrl(req, res);

        expect(res.render).toHaveBeenCalledWith(
            'partials/url-list-results',
            expect.objectContaining({
                requestData: mockRequestData
            })
        );
    });

    it('passes suggestion to render', () => {
        searchUrl(req, res);

        expect(res.render).toHaveBeenCalledWith(
            'partials/url-list-results',
            expect.objectContaining({
                suggestion: 'suggested.com'
            })
        );
    });

    it('handles empty API results', () => {
        mockApiRequest.get.mockImplementationOnce((params, callback) => {
            callback([]);
        });

        searchUrl(req, res);

        expect(res.render).toHaveBeenCalledWith(
            'partials/url-list-results',
            expect.objectContaining({
                apiData: []
            })
        );
    });

    it('uses default language when language is not provided', () => {
        mockRequestData.get = jest.fn((key) => {
            const map = { q: 'example.com', l: undefined, viewMode: 'list' };
            return map[key];
        });
        sanitizeInputs.mockReturnValue(mockRequestData);

        searchUrl(req, res);

        expect(mockSuggestionRequest.getSuggestion).toHaveBeenCalledWith(
            'example.com',
            'pt',
            expect.any(Function)
        );
    });
});
