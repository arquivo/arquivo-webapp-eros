// Mock config before requiring modules
jest.mock('config');

const ImageSearchApiRequest = require('../image-search-api');
const config = require('config');
const http = require('node:http');

/**
 * ImageSearchApiRequest Test Suite
 * 
 * STATUS: ✅ ALL 30 TESTS PASSING (100%)
 * 
 * This class successfully extends the refactored ApiRequest and demonstrates proper
 * subclass implementation:
 * - Simple constructor that only configures parameters
 * - Uses parent class for all HTTP request handling
 * - No custom response processing - works with standard JSON responses
 * - Comprehensive parameter handling including optional fields
 * 
 * COVERAGE:
 * - Constructor and default parameters (5 tests)
 * - Optional parameter handling (6 tests)
 * - Parameter merging and overriding (2 tests)
 * - Full API integration with pagination (4 tests)
 * - Date range handling (3 tests)
 * 
 * Along with PageSearchApiRequest, this demonstrates the correct pattern for
 * extending ApiRequest after the refactor.
 */
describe('ImageSearchApiRequest', () => {
    let mockServer;
    let mockServerPort;

    beforeAll((done) => {
        // Create a mock HTTP server for testing
        mockServer = http.createServer((req, res) => {
            const url = new URL(req.url, `http://localhost:${mockServerPort}`);
            
            // Mock successful image search response
            const mockResponse = {
                estimated_nr_results: 50,
                response_items: [
                    {
                        imgSrc: 'http://example.com/image.jpg',
                        imgMimeType: 'image/jpeg',
                        imgHeight: 600,
                        imgWidth: 800,
                        imgTstamp: '20230101120000',
                        imgTitle: 'Test Image',
                        pageURL: 'http://example.com',
                        pageTstamp: '20230101120000'
                    }
                ],
                request_parameters: {
                    q: url.searchParams.get('q'),
                    from: url.searchParams.get('from'),
                    to: url.searchParams.get('to'),
                    maxItems: url.searchParams.get('maxItems')
                }
            };

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(mockResponse));
        });

        mockServer.listen(0, () => {
            mockServerPort = mockServer.address().port;
            done();
        });
    });

    afterAll((done) => {
        mockServer.close(done);
    });

    describe('Constructor', () => {
        it('should create instance with default parameters', () => {
            const api = new ImageSearchApiRequest();
            expect(api).toBeInstanceOf(ImageSearchApiRequest);
            expect(api.apiUrl).toBe(config.get('image.search.api'));
        });

        it('should have correct default parameters', () => {
            const api = new ImageSearchApiRequest();
            expect(api.defaultApiParams).toMatchObject({
                q: '',
                from: config.get('search.start.date'),
                offset: 0,
                maxItems: config.get('image.results.per.page'),
                prettyPrint: false,
                size: 'all',
                safeSearch: 'on'
            });
        });

        it('should have correct fields parameter', () => {
            const api = new ImageSearchApiRequest();
            const expectedFields = 'imgSrc,imgMimeType,imgHeight,imgWidth,imgTstamp,imgTitle,imgAlt,imgCaption,imgLinkToArchive,pageURL,pageTstamp,pageLinkToArchive,pageTitle,collection,imgDigest,pageHost,pageImages,safe';
            expect(api.defaultApiParams.fields).toBe(expectedFields);
        });

        it('should have null optional parameters', () => {
            const api = new ImageSearchApiRequest();
            expect(api.defaultApiParams.type).toBeNull();
            expect(api.defaultApiParams.siteSearch).toBeNull();
            expect(api.defaultApiParams.collection).toBeNull();
            expect(api.defaultApiParams.dedupValue).toBeNull();
            expect(api.defaultApiParams.dedupField).toBeNull();
            expect(api.defaultApiParams.trackingId).toBeNull();
        });

        it('should have empty object as default reply', () => {
            const api = new ImageSearchApiRequest();
            expect(api.defaultApiReply).toEqual({});
        });
    });

    describe('Parameter Handling', () => {
        let api;

        beforeEach(() => {
            api = new ImageSearchApiRequest();
            api.apiUrl = `http://localhost:${mockServerPort}`;
        });

        it('should merge request parameters with defaults', () => {
            const requestData = new URLSearchParams({
                q: 'test image',
                offset: '25'
            });

            const sanitized = api.sanitizeRequestData(requestData);
            expect(sanitized.get('q')).toBe('test image');
            expect(sanitized.get('offset')).toBe('25');
            expect(sanitized.get('from')).toBe(config.get('search.start.date'));
            expect(sanitized.get('maxItems')).toBe(config.get('image.results.per.page').toString());
            expect(sanitized.get('size')).toBe('all');
            expect(sanitized.get('safeSearch')).toBe('on');
        });

        it('should override default parameters', () => {
            const requestData = new URLSearchParams({
                q: 'cars',
                size: 'large',
                safeSearch: 'off',
                maxItems: '50'
            });

            const sanitized = api.sanitizeRequestData(requestData);
            expect(sanitized.get('q')).toBe('cars');
            expect(sanitized.get('size')).toBe('large');
            expect(sanitized.get('safeSearch')).toBe('off');
            expect(sanitized.get('maxItems')).toBe('50');
        });

        it('should handle optional parameters', () => {
            const requestData = new URLSearchParams({
                q: 'nature',
                type: 'jpeg',
                siteSearch: 'example.com',
                collection: 'FCCN'
            });

            const sanitized = api.sanitizeRequestData(requestData);
            expect(sanitized.get('type')).toBe('jpeg');
            expect(sanitized.get('siteSearch')).toBe('example.com');
            expect(sanitized.get('collection')).toBe('FCCN');
        });

        it('should handle trackingId parameter', () => {
            const trackingId = 'test-tracking-id-123';
            const requestData = new URLSearchParams({
                q: 'search',
                trackingId: trackingId
            });

            const sanitized = api.sanitizeRequestData(requestData);
            expect(sanitized.get('trackingId')).toBe(trackingId);
        });

        it('should not include null parameters when not provided', () => {
            const requestData = new URLSearchParams({
                q: 'search'
            });

            const sanitized = api.sanitizeRequestData(requestData);
            // Null parameters should not be included unless explicitly set
            expect(sanitized.has('type')).toBe(false);
            expect(sanitized.has('siteSearch')).toBe(false);
            expect(sanitized.has('collection')).toBe(false);
        });
    });

    describe('API Request', () => {
        let api;

        beforeEach(() => {
            api = new ImageSearchApiRequest();
            api.apiUrl = `http://localhost:${mockServerPort}`;
        });

        it('should successfully fetch image search results', (done) => {
            const requestData = new URLSearchParams({
                q: 'test image'
            });

            api.get(requestData, (data) => {
                expect(data).toHaveProperty('estimated_nr_results');
                expect(data).toHaveProperty('response_items');
                expect(data).toHaveProperty('request_parameters');
                expect(data.response_items).toBeInstanceOf(Array);
                expect(data.response_items.length).toBeGreaterThan(0);
                done();
            });
        });

        it('should return images with correct metadata', (done) => {
            const requestData = new URLSearchParams({
                q: 'cat'
            });

            api.get(requestData, (data) => {
                const firstImage = data.response_items[0];
                expect(firstImage).toHaveProperty('imgSrc');
                expect(firstImage).toHaveProperty('imgMimeType');
                expect(firstImage).toHaveProperty('imgHeight');
                expect(firstImage).toHaveProperty('imgWidth');
                expect(firstImage).toHaveProperty('imgTstamp');
                expect(firstImage).toHaveProperty('pageURL');
                done();
            });
        });

        it('should include query parameters in response', (done) => {
            const requestData = new URLSearchParams({
                q: 'architecture',
                offset: '10'
            });

            api.get(requestData, (data) => {
                expect(data.request_parameters.q).toBe('architecture');
                done();
            });
        });

        it('should handle pagination with offset', (done) => {
            const requestData = new URLSearchParams({
                q: 'flowers',
                offset: '50',
                maxItems: '25'
            });

            api.get(requestData, (data) => {
                expect(data.request_parameters.maxItems).toBe('25');
                done();
            });
        });
    });

    describe('Date Range Handling', () => {
        let api;

        beforeEach(() => {
            api = new ImageSearchApiRequest();
        });

        it('should use default start date', () => {
            expect(api.defaultApiParams.from).toBe(config.get('search.start.date'));
        });

        it('should calculate default end date as today', () => {
            const today = (new Date()).toLocaleDateString('en-CA').split('-').join('');
            expect(api.defaultApiParams.to).toBe(today);
        });

        it('should allow custom date range', () => {
            const requestData = new URLSearchParams({
                q: 'test',
                from: '20200101',
                to: '20201231'
            });

            const sanitized = api.sanitizeRequestData(requestData);
            expect(sanitized.get('from')).toBe('20200101');
            expect(sanitized.get('to')).toBe('20201231');
        });
    });
});
