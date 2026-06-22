'use strict';

const searchPages = require('../search-pages');

// Mock dependencies
jest.mock('../utils/sanitize-search-params');
jest.mock('../apis/page-search-api');
jest.mock('../apis/suggestion-api');
jest.mock('../export-page-search');

const sanitizeInputs = require('../utils/sanitize-search-params');
const PageSearchApiRequest = require('../apis/page-search-api');
const SuggestionApi = require('../apis/suggestion-api');
const makeExportObject = require('../export-page-search');

describe('search-pages handler', () => {
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
            const map = { q: 'test query', l: 'pt', api: 'solr' };
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
                callback({ response_items: [{ title: 'Result 1' }] });
            }),
            sanitizeRequestData: jest.fn((data) => data)
        };
        PageSearchApiRequest.mockImplementation(() => mockApiRequest);

        mockSuggestionRequest = {
            getSuggestion: jest.fn((query, lang, callback) => {
                callback('suggested term');
            })
        };
        SuggestionApi.mockImplementation(() => mockSuggestionRequest);

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

    it('creates SuggestionApi instance', () => {
        searchPages(req, res);

        expect(SuggestionApi).toHaveBeenCalled();
    });

    it('requests suggestion with query and language', () => {
        searchPages(req, res);

        expect(mockSuggestionRequest.getSuggestion).toHaveBeenCalledWith(
            'test query',
            'pt',
            expect.any(Function)
        );
    });

    it('requests API with sanitized request data', () => {
        searchPages(req, res);

        expect(mockApiRequest.get).toHaveBeenCalledWith(
            mockRequestData,
            expect.any(Function)
        );
    });

    it('renders partials/pages-search-results with results data', () => {
        searchPages(req, res);

        expect(res.render).toHaveBeenCalledWith('partials/pages-search-results', {
            requestData: mockRequestData,
            apiData: { response_items: [{ title: 'Result 1' }] },
            suggestion: 'suggested term',
            exportObject: { export: 'data' }
        });
    });

    it('creates export object with sanitized request data', () => {
        searchPages(req, res);

        expect(makeExportObject).toHaveBeenCalledWith(
            mockRequestData,
            { response_items: [{ title: 'Result 1' }] },
            req.t
        );
    });

    it('handles empty results from API', () => {
        mockApiRequest.get.mockImplementationOnce((params, callback) => {
            callback({ response_items: [] });
        });

        searchPages(req, res);

        expect(res.render).toHaveBeenCalledWith('partials/pages-search-results', {
            requestData: mockRequestData,
            apiData: { response_items: [] },
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

    it('uses default language when language is not provided', () => {
        mockRequestData.get = jest.fn((key) => {
            const map = { q: 'test query', l: undefined, api: 'solr' };
            return map[key];
        });
        sanitizeInputs.mockReturnValue(mockRequestData);

        searchPages(req, res);

        expect(mockSuggestionRequest.getSuggestion).toHaveBeenCalledWith(
            'test query',
            'pt',
            expect.any(Function)
        );
    });
});
