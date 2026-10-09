// Mock config before requiring modules
jest.mock('config');

const PageSearchApiRequest = require('../page-search-api');
const config = require('config');
const http = require('node:http');

/**
 * PageSearchApiRequest Test Suite
 * 
 * STATUS: ✅ ALL 22 TESTS PASSING (100%)
 * 
 * This class successfully extends the refactored ApiRequest and demonstrates proper
 * subclass implementation:
 * - Overrides sanitizeRequestData() to clean inline parameters from queries
 * - Uses constructor to configure backend endpoints (solr, nutchwax, default)
 * - Maintains all default parameter handling through parent class
 * - No custom response processing needed - works with standard JSON responses
 * 
 * COVERAGE:
 * - Constructor with different backends (3 tests)
 * - Default parameters and reply structure (2 tests)
 * - Inline parameter sanitization for site, type, collection, safe, size (7 tests)
 * - Parameter merging with defaults (1 test)
 * - Full API integration (3 tests)
 * 
 * This serves as the model for how to properly extend ApiRequest after the refactor.
 */
describe('PageSearchApiRequest', () => {
    let mockServer;
    let mockServerPort;

    beforeAll((done) => {
        // Create a mock HTTP server for testing
        mockServer = http.createServer((req, res) => {
            const url = new URL(req.url, `http://localhost:${mockServerPort}`);
            
            // Mock successful text search response
            const mockResponse = {
                estimated_nr_results: 100,
                response_items: [
                    {
                        title: 'Test Result',
                        url: 'http://example.com',
                        tstamp: '20230101120000'
                    }
                ],
                request_parameters: {
                    q: url.searchParams.get('q'),
                    from: url.searchParams.get('from'),
                    to: url.searchParams.get('to'),
                    offset: url.searchParams.get('offset'),
                    maxItems: url.searchParams.get('maxItems'),
                    fields: url.searchParams.get('fields')
                }
            };
            if ((url.searchParams.get('fields') ?? '').split(',').includes('spellcheck')) {
                mockResponse.suggested_query = url.searchParams.get('q').trim() === 'Lizboa' ? 'lisboa ' : '';
            }

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
        it('should create instance with default backend', () => {
            const api = new PageSearchApiRequest();
            expect(api).toBeInstanceOf(PageSearchApiRequest);
            expect(api.apiUrl).toBe(config.get('text.search.api.default'));
        });

        it('should create instance with solr backend', () => {
            const api = new PageSearchApiRequest('solr');
            expect(api.apiUrl).toBe(config.get('text.search.api.solr'));
        });

        it('should create instance with nutchwax backend', () => {
            const api = new PageSearchApiRequest('nutchwax');
            expect(api.apiUrl).toBe(config.get('text.search.api.nutchwax'));
        });

        it('should have correct default parameters', () => {
            const api = new PageSearchApiRequest();
            expect(api.defaultApiParams).toMatchObject({
                q: null,
                from: config.get('search.start.date'),
                offset: 0,
                maxItems: config.get('text.results.per.page'),
                dedupValue: 1,
                prettyPrint: false
            });
        });

        it('should have default reply structure', () => {
            const api = new PageSearchApiRequest();
            expect(api.defaultApiReply).toMatchObject({
                estimated_nr_results: 0,
                response_items: [],
                request_parameters: expect.any(Object)
            });
        });
    });

    describe('yearBalance feature toggle', () => {
        afterEach(() => {
            config.set('text.search.api.yearBalance_enabled', false);
        });

        it('should not include yearBalance param when disabled', () => {
            config.set('text.search.api.yearBalance_enabled', false);
            const api = new PageSearchApiRequest();

            const sanitized = api.sanitizeRequestData(new URLSearchParams({ q: 'test query' }));

            expect(sanitized.has('yearBalance')).toBe(false);
        });

        it('should include yearBalance=true param when enabled', () => {
            config.set('text.search.api.yearBalance_enabled', true);
            const api = new PageSearchApiRequest();

            const sanitized = api.sanitizeRequestData(new URLSearchParams({ q: 'test query' }));

            expect(sanitized.get('yearBalance')).toBe('true');
        });
    });

    describe('spellcheck', () => {
        afterEach(() => {
            config.set('text.search.api.spellcheck_enabled', true);
        });

        describe('withSpellcheck', () => {
            it('should add spellcheck to the requested fields', () => {
                const api = new PageSearchApiRequest();

                const requestData = api.withSpellcheck(new URLSearchParams({ q: 'Lizboa' }));

                expect(requestData.get('fields')).toBe('spellcheck');
                expect(requestData.get('q')).toBe('Lizboa');
            });

            it('should keep other requested fields', () => {
                const api = new PageSearchApiRequest();

                const requestData = api.withSpellcheck(new URLSearchParams({ q: 'Lizboa', fields: 'title, originalURL' }));

                expect(requestData.get('fields')).toBe('title,originalURL,spellcheck');
            });

            it('should not repeat spellcheck if already requested', () => {
                const api = new PageSearchApiRequest();

                const requestData = api.withSpellcheck(new URLSearchParams({ q: 'Lizboa', fields: 'spellcheck' }));

                expect(requestData.get('fields')).toBe('spellcheck');
            });

            it('should not modify the original request data', () => {
                const api = new PageSearchApiRequest();
                const original = new URLSearchParams({ q: 'Lizboa' });

                api.withSpellcheck(original);

                expect(original.has('fields')).toBe(false);
            });

            it('should leave request data unchanged when disabled', () => {
                config.set('text.search.api.spellcheck_enabled', false);
                const api = new PageSearchApiRequest();
                const original = new URLSearchParams({ q: 'Lizboa' });

                expect(api.withSpellcheck(original)).toBe(original);
            });
        });

        describe('getSuggestion', () => {
            const params = (q, extra = {}) => new URLSearchParams({ q, ...extra });

            it('should return the suggested query', () => {
                const api = new PageSearchApiRequest();
                expect(api.getSuggestion({ suggested_query: 'lisboa' }, params('Lizboa'))).toBe('lisboa');
            });

            it('should return the original query when the suggestion is empty', () => {
                const api = new PageSearchApiRequest();
                expect(api.getSuggestion({ suggested_query: '' }, params('Lisboa'))).toBe('Lisboa');
                expect(api.getSuggestion({ suggested_query: ' ' }, params('Lisboa'))).toBe('Lisboa');
            });

            it('should return the original query when there is no suggestion', () => {
                const api = new PageSearchApiRequest();
                expect(api.getSuggestion({ response_items: [] }, params('Lisboa'))).toBe('Lisboa');
                expect(api.getSuggestion(undefined, params('Lisboa'))).toBe('Lisboa');
            });

            it('should trim the suggested query', () => {
                const api = new PageSearchApiRequest();
                expect(api.getSuggestion({ suggested_query: 'ronaldo ' }, params('Ronaldi'))).toBe('ronaldo');
            });

            it('should add back the inline terms the API did not spellcheck, as typed', () => {
                const api = new PageSearchApiRequest();
                const requestData = params('Ronaldi collection:Roteiro', { collection: 'Roteiro' });

                expect(api.getSuggestion({ suggested_query: 'ronaldo ' }, requestData)).toBe('ronaldo collection:Roteiro');
            });

            it('should add back every inline term, whatever their position in the query', () => {
                const api = new PageSearchApiRequest();
                const requestData = params('site:www.publico.pt Lizboa type:pdf -futebol', {
                    siteSearch: 'www.publico.pt',
                    type: 'pdf',
                });

                expect(api.getSuggestion({ suggested_query: 'lisboa -futebol' }, requestData))
                    .toBe('lisboa -futebol site:www.publico.pt type:pdf');
            });

            it('should not add terms that are only parameters, not typed in the query', () => {
                const api = new PageSearchApiRequest();
                const requestData = params('Lizboa', { collection: 'Roteiro', siteSearch: 'www.publico.pt' });

                expect(api.getSuggestion({ suggested_query: 'lisboa' }, requestData)).toBe('lisboa');
            });
        });

        describe('suggest', () => {
            let api;

            beforeEach(() => {
                api = new PageSearchApiRequest();
                api.apiUrl = `http://localhost:${mockServerPort}`;
            });

            it('should return the suggested query', (done) => {
                api.suggest(new URLSearchParams({ q: 'Lizboa' }), (suggestion) => {
                    expect(suggestion).toBe('lisboa');
                    done();
                });
            });

            it('should keep the inline terms in the suggested query', (done) => {
                api.suggest(new URLSearchParams({ q: 'Lizboa size:lg', size: 'lg' }), (suggestion) => {
                    expect(suggestion).toBe('lisboa size:lg');
                    done();
                });
            });

            it('should return the original query when there is no suggestion', (done) => {
                api.suggest(new URLSearchParams({ q: 'Lisboa' }), (suggestion) => {
                    expect(suggestion).toBe('Lisboa');
                    done();
                });
            });

            it('should request spellcheck without results', (done) => {
                const getSpy = jest.spyOn(api, 'get');

                api.suggest(new URLSearchParams({ q: 'Lizboa', offset: '50', maxItems: '25' }), () => {
                    const requestData = getSpy.mock.calls[0][0];
                    expect(requestData.get('fields')).toBe('spellcheck');
                    expect(requestData.get('maxItems')).toBe('0');
                    expect(requestData.get('offset')).toBe('0');
                    done();
                });
            });

            it('should return the original query when the API fails', (done) => {
                api.apiUrl = 'http://localhost:1';

                api.suggest(new URLSearchParams({ q: 'Lizboa' }), (suggestion) => {
                    expect(suggestion).toBe('Lizboa');
                    done();
                });
            });

            it('should return the original query without calling the API when disabled', (done) => {
                config.set('text.search.api.spellcheck_enabled', false);
                api = new PageSearchApiRequest();
                const getSpy = jest.spyOn(api, 'get');

                api.suggest(new URLSearchParams({ q: 'Lizboa' }), (suggestion) => {
                    expect(suggestion).toBe('Lizboa');
                    expect(getSpy).not.toHaveBeenCalled();
                    done();
                });
            });
        });

        it('should apply custom request options', () => {
            const api = new PageSearchApiRequest(null, { timeout: 3000 });
            expect(api.options).toMatchObject({ method: 'GET', timeout: 3000 });
        });
    });

    describe('sanitizeRequestData', () => {
        let api;

        beforeEach(() => {
            // Override config to use mock server
            config.get('text.search.api.default');
            api = new PageSearchApiRequest();
            api.apiUrl = `http://localhost:${mockServerPort}`;
        });

        it('should remove site: inline parameter from query', () => {
            const requestData = new URLSearchParams({
                q: 'test site:example.com query',
                siteSearch: 'example.com'
            });

            const sanitized = api.sanitizeRequestData(requestData);
            const queryParam = sanitized.get('q');
            
            expect(queryParam).not.toContain('site:example.com');
            expect(queryParam).toContain('test');
            expect(queryParam).toContain('query');
        });

        it('should remove type: inline parameter from query', () => {
            const requestData = new URLSearchParams({
                q: 'test type:pdf query',
                type: 'pdf'
            });

            const sanitized = api.sanitizeRequestData(requestData);
            const queryParam = sanitized.get('q');
            
            expect(queryParam).not.toContain('type:pdf');
            expect(queryParam).toContain('test');
            expect(queryParam).toContain('query');
        });

        it('should remove collection: inline parameter from query', () => {
            const requestData = new URLSearchParams({
                q: 'test collection:FCCN query',
                collection: 'FCCN'
            });

            const sanitized = api.sanitizeRequestData(requestData);
            const queryParam = sanitized.get('q');
            
            expect(queryParam).not.toContain('collection:FCCN');
            expect(queryParam).toContain('test');
            expect(queryParam).toContain('query');
        });

        it('should remove safe: inline parameter (safeSearch) from query', () => {
            const requestData = new URLSearchParams({
                q: 'test safe:on query',
                safeSearch: 'on'
            });

            const sanitized = api.sanitizeRequestData(requestData);
            const queryParam = sanitized.get('q');
            
            expect(queryParam).not.toContain('safe:on');
            expect(queryParam).toContain('test');
            expect(queryParam).toContain('query');
        });

        it('should remove size: inline parameter from query', () => {
            const requestData = new URLSearchParams({
                q: 'test size:large query',
                size: 'large'
            });

            const sanitized = api.sanitizeRequestData(requestData);
            const queryParam = sanitized.get('q');
            
            expect(queryParam).not.toContain('size:large');
            expect(queryParam).toContain('test');
            expect(queryParam).toContain('query');
        });

        it('should remove multiple inline parameters from query', () => {
            const requestData = new URLSearchParams({
                q: 'test site:example.com type:pdf query',
                siteSearch: 'example.com',
                type: 'pdf'
            });

            const sanitized = api.sanitizeRequestData(requestData);
            const queryParam = sanitized.get('q');
            
            expect(queryParam).not.toContain('site:example.com');
            expect(queryParam).not.toContain('type:pdf');
            expect(queryParam).toContain('test');
            expect(queryParam).toContain('query');
        });

        it('should handle query without inline parameters', () => {
            const requestData = new URLSearchParams({
                q: 'simple test query'
            });

            const sanitized = api.sanitizeRequestData(requestData);
            expect(sanitized.get('q')).toBe('simple test query');
        });

        it('should merge with default parameters', () => {
            const requestData = new URLSearchParams({
                q: 'test query',
                offset: '10'
            });

            const sanitized = api.sanitizeRequestData(requestData);
            expect(sanitized.get('q')).toBe('test query');
            expect(sanitized.get('offset')).toBe('10');
            expect(sanitized.get('from')).toBe(config.get('search.start.date'));
            expect(sanitized.get('maxItems')).toBe(config.get('text.results.per.page').toString());
        });
    });

    describe('API Request', () => {
        let api;

        beforeEach(() => {
            api = new PageSearchApiRequest();
            api.apiUrl = `http://localhost:${mockServerPort}`;
        });

        it('should successfully fetch search results', (done) => {
            const requestData = new URLSearchParams({
                q: 'test query'
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

        it('should include query parameters in request', (done) => {
            const requestData = new URLSearchParams({
                q: 'arquivo test',
                offset: '20'
            });

            api.get(requestData, (data) => {
                expect(data.request_parameters.q).toBe('arquivo test');
                done();
            });
        });
    });
});
