const replayNav = require('../replay-nav');
const sanitizeInputs = require('../utils/sanitize-search-params');
const CDXSearchApiRequest = require('../apis/cdx-api');
const cdxFilter = require('../filter-cdx');

// Mock dependencies
jest.mock('../utils/sanitize-search-params');
jest.mock('../apis/cdx-api');
jest.mock('../filter-cdx');

/**
 * Helper function to setup mocks for replay-nav tests
 * @param {Object} options - Configuration options
 * @param {string} options.url - URL to use in request data
 * @param {Array} options.apiData - Data returned by API
 * @param {Array} options.filteredData - Data returned by filter (defaults to apiData)
 * @returns {Object} - Mock objects { req, res, apiRequest, requestData }
 */
function setupMocks({ url = 'http://example.com', apiData = [], filteredData = null } = {}) {
    jest.clearAllMocks();

    const mockReq = {
        query: { url }
    };

    const mockRes = {
        render: jest.fn()
    };

    const mockRequestData = new URLSearchParams({ url });
    sanitizeInputs.mockReturnValue(mockRequestData);

    const mockApiRequest = {
        get: jest.fn((params, callback) => {
            callback(apiData);
        })
    };
    CDXSearchApiRequest.mockImplementation(() => mockApiRequest);

    cdxFilter.mockImplementation((data) => filteredData === null ? data : filteredData);

    return { req: mockReq, res: mockRes, apiRequest: mockApiRequest, requestData: mockRequestData };
}

describe('replay-nav', () => {
    it('should create CDXSearchApiRequest instance', () => {
        const { req, res } = setupMocks();
        replayNav(req, res);
        expect(CDXSearchApiRequest).toHaveBeenCalledTimes(1);
    });

    it('should sanitize request inputs', () => {
        const { req, res } = setupMocks();
        replayNav(req, res);
        expect(sanitizeInputs).toHaveBeenCalledWith(req, res);
    });

    it('should call API with URLSearchParams containing url', () => {
        const { req, res, apiRequest } = setupMocks({ url: 'http://example.com' });
        replayNav(req, res);

        expect(apiRequest.get).toHaveBeenCalledTimes(1);
        const callArgs = apiRequest.get.mock.calls[0];
        const urlParams = callArgs[0];

        expect(urlParams).toBeInstanceOf(URLSearchParams);
        expect(urlParams.get('url')).toBe('http://example.com');
    });

    it('should render replay-nav partial with filtered data', () => {
        const apiData = [
            { url: 'http://example.com', timestamp: '20230101120000', status: '200' }
        ];
        const { req, res, requestData } = setupMocks({ apiData });

        replayNav(req, res);

        expect(cdxFilter).toHaveBeenCalledWith(apiData);
        expect(res.render).toHaveBeenCalledWith('partials/replay-nav', {
            requestData,
            apiData
        });
    });

    it('should handle empty API response', () => {
        const { req, res, requestData } = setupMocks({ apiData: [] });

        replayNav(req, res);

        expect(cdxFilter).toHaveBeenCalledWith([]);
        expect(res.render).toHaveBeenCalledWith('partials/replay-nav', {
            requestData,
            apiData: []
        });
    });

    it('should filter API data before rendering', () => {
        const apiData = [
            { url: 'http://example.com', timestamp: '20230101120000', status: '200' },
            { url: 'http://example.com', timestamp: '20230102120000', status: '404' }
        ];
        const filteredData = [apiData[0]]; // Only 200 status
        const { req, res, requestData } = setupMocks({ apiData, filteredData });

        replayNav(req, res);

        expect(cdxFilter).toHaveBeenCalledWith(apiData);
        expect(res.render).toHaveBeenCalledWith('partials/replay-nav', {
            requestData,
            apiData: filteredData
        });
    });

    it('should extract url from sanitized request data', () => {
        const { req, res, apiRequest } = setupMocks({ url: 'http://custom.com' });

        replayNav(req, res);

        const callArgs = apiRequest.get.mock.calls[0];
        const urlParams = callArgs[0];
        expect(urlParams.get('url')).toBe('http://custom.com');
    });
});
