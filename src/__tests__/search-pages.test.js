'use strict';

const searchPages = require('../search-pages');

// Mock dependencies
jest.mock('../utils/sanitize-search-params');
jest.mock('../apis/page-search-api');
jest.mock('../export-page-search');

const sanitizeInputs = require('../utils/sanitize-search-params');
const PageSearchApiRequest = require('../apis/page-search-api');
const makeExportObject = require('../export-page-search');

describe('search-pages handler', () => {
    let req, res;
    let mockRequestData;
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
            sanitizeRequestData: jest.fn((data) => data)
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
            mockRequestData,
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
});
