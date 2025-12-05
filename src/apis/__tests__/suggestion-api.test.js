// Mock config before requiring modules
jest.mock('config');

const SuggestionApiRequest = require('../suggestion-api');
const config = require('config');
const http = require('http');

/**
 * SuggestionApiRequest Test Suite
 * 
 * CURRENT STATUS: 19/23 tests passing (4 failing - 17% failure rate)
 * 
 * ROOT CAUSE OF FAILURES:
 * The SuggestionApiRequest class relies on custom response handlers (dataFunction, endFunction)
 * that are NOT supported by the refactored ApiRequest class. These handlers were used to:
 * 1. Accumulate HTML response and strip newlines
 * 2. Parse HTML to extract suggestions from <div id="correction"><em>...</em></div>
 * 3. Fall back to original query if no suggestion found
 * 
 * FAILING TESTS:
 * - HTML Parsing - endFunction (3 tests)
 * - Timeout Handling (1 test)
 * 
 * These failures document the incompatibility between SuggestionApiRequest's custom
 * processing needs and the refactored ApiRequest implementation that removed extensibility
 * hooks to fix memory leaks and callback safety issues.
 * 
 * DECISION NEEDED:
 * 1. Revert ApiRequest refactor (reintroduces bugs)
 * 2. Make SuggestionApiRequest standalone (recommended - separates concerns)
 * 3. Add extensibility back to ApiRequest (more complex)
 */
describe('SuggestionApiRequest', () => {
    let mockServer;
    let mockServerPort;
    let mockServerDelay = 0;

    beforeAll((done) => {
        // Create a mock HTTP server for testing
        mockServer = http.createServer((req, res) => {
            const url = new URL(req.url, `http://localhost:${mockServerPort}`);
            const query = url.searchParams.get('query');
            
            setTimeout(() => {
                // Mock suggestion response with HTML format
                const mockResponse = `<div id="correction"><em>${query} suggestion</em></div>`;

                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(mockResponse);
            }, mockServerDelay);
        });

        mockServer.listen(0, () => {
            mockServerPort = mockServer.address().port;
            done();
        });
    });

    afterAll((done) => {
        mockServer.close(done);
    });

    afterEach(() => {
        mockServerDelay = 0;
    });

    describe('Constructor', () => {
        it('should create instance with default parameters', () => {
            const api = new SuggestionApiRequest();
            expect(api).toBeInstanceOf(SuggestionApiRequest);
            expect(api.apiUrl).toBe(config.get('query.suggestion.api'));
        });

        it('should have correct default parameters', () => {
            const api = new SuggestionApiRequest();
            expect(api.defaultApiParams).toMatchObject({
                query: '',
                l: 'pt'
            });
        });

        it('should have empty string as default reply', () => {
            const api = new SuggestionApiRequest();
            expect(api.defaultApiReply).toBe('');
        });

        it('should have short timeout (1000ms)', () => {
            const api = new SuggestionApiRequest();
            expect(api.options.timeout).toBe(1000);
        });



        it('should read enabled state from config', () => {
            const api = new SuggestionApiRequest();
            const expectedEnabled = config.has('query.suggestion.api_enabled') && 
                                   config.get('query.suggestion.api_enabled') === true;
            expect(api.enabled).toBe(expectedEnabled);
        });
    });

    describe('getSuggestion - Enabled', () => {
        let api;

        beforeEach(() => {
            api = new SuggestionApiRequest();
            api.apiUrl = `http://localhost:${mockServerPort}`;
            api.enabled = true; // Force enable for testing
        });

        it('should fetch suggestion when enabled', (done) => {
            api.getSuggestion('test', 'pt', (suggestion) => {
                expect(suggestion).toBeDefined();
                expect(typeof suggestion).toBe('string');
                done();
            });
        });

        it('should extract suggestion from HTML response', (done) => {
            api.getSuggestion('arquivo', 'pt', (suggestion) => {
                expect(suggestion).toContain('suggestion');
                done();
            });
        });

        it('should handle Portuguese language parameter', (done) => {
            api.getSuggestion('busca', 'pt', (suggestion) => {
                expect(suggestion).toBeDefined();
                done();
            });
        });

        it('should handle English language parameter', (done) => {
            api.getSuggestion('search', 'en', (suggestion) => {
                expect(suggestion).toBeDefined();
                done();
            });
        });

        it('should handle empty query', (done) => {
            api.getSuggestion('', 'pt', (suggestion) => {
                expect(suggestion).toBeDefined();
                done();
            });
        });
    });

    describe('getSuggestion - Disabled', () => {
        let api;

        beforeEach(() => {
            api = new SuggestionApiRequest();
            api.enabled = false; // Force disable for testing
        });

        it('should return original query when disabled', (done) => {
            api.getSuggestion('test query', 'pt', (suggestion) => {
                expect(suggestion).toBe('test query');
                done();
            });
        });

        it('should not make HTTP request when disabled', (done) => {
            const originalGet = api.get;
            const getSpy = jest.fn(originalGet);
            api.get = getSpy;

            api.getSuggestion('test', 'pt', (suggestion) => {
                expect(getSpy).not.toHaveBeenCalled();
                expect(suggestion).toBe('test');
                done();
            });
        });

        it('should handle empty query when disabled', (done) => {
            api.getSuggestion('', 'pt', (suggestion) => {
                expect(suggestion).toBe('');
                done();
            });
        });

        it('should use nextTick for async behavior when disabled', (done) => {
            let callbackCalled = false;
            
            api.getSuggestion('async test', 'pt', (suggestion) => {
                callbackCalled = true;
                expect(suggestion).toBe('async test');
                done();
            });

            // Callback should not be called synchronously
            expect(callbackCalled).toBe(false);
        });
    });

    describe('HTML Parsing - endFunction', () => {
        let api;
        let customMockServer;
        let customMockServerPort;

        beforeEach((done) => {
            api = new SuggestionApiRequest();
            api.enabled = true;

            // Create custom mock server for specific HTML responses
            customMockServer = http.createServer((req, res) => {
                const url = new URL(req.url, `http://localhost:${customMockServerPort}`);
                const query = url.searchParams.get('query');
                
                let mockResponse;
                if (query === 'with-correction') {
                    mockResponse = `<html><body><div id="correction"><em>corrected query</em></div></body></html>`;
                } else if (query === 'no-correction') {
                    mockResponse = `<html><body><div>no correction</div></body></html>`;
                } else if (query === 'multiline') {
                    mockResponse = `<html>\n<body>\n<div id="correction">\n<em>corrected</em>\n</div>\n</body>\n</html>`;
                } else {
                    mockResponse = `<div id="correction"><em>default</em></div>`;
                }

                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(mockResponse);
            });

            customMockServer.listen(0, () => {
                customMockServerPort = customMockServer.address().port;
                api.apiUrl = `http://localhost:${customMockServerPort}`;
                done();
            });
        });

        afterEach((done) => {
            customMockServer.close(done);
        });

        it('should extract suggestion from correction div', (done) => {
            const requestData = new URLSearchParams({
                query: 'with-correction'
            });

            api.get(requestData, (suggestion) => {
                expect(suggestion).toBe('corrected query');
                done();
            });
        });

        it('should return original query when no correction found', (done) => {
            const requestData = new URLSearchParams({
                query: 'no-correction'
            });

            api.get(requestData, (suggestion) => {
                expect(suggestion).toBe('no-correction');
                done();
            });
        });

        it('should handle multiline HTML (strips newlines)', (done) => {
            const requestData = new URLSearchParams({
                query: 'multiline'
            });

            api.get(requestData, (suggestion) => {
                expect(suggestion).not.toContain('\n');
                expect(suggestion).toBe('corrected');
                done();
            });
        });
    });

    describe('Timeout Handling', () => {
        let api;
        let slowMockServer;
        let slowMockServerPort;
        let pendingTimeout;

        beforeEach((done) => {
            api = new SuggestionApiRequest();
            api.enabled = true;

            // Create a slow mock server that delays responses
            slowMockServer = http.createServer((req, res) => {
                // Delay response for 2 seconds (longer than 1s timeout)
                pendingTimeout = setTimeout(() => {
                    if (!res.destroyed) {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end('<div id="correction"><em>late response</em></div>');
                    }
                }, 2000);
            });

            slowMockServer.listen(0, () => {
                slowMockServerPort = slowMockServer.address().port;
                api.apiUrl = `http://localhost:${slowMockServerPort}`;
                done();
            });
        });

        afterEach((done) => {
            if (pendingTimeout) {
                clearTimeout(pendingTimeout);
            }
            slowMockServer.close(done);
        });

        it('should timeout and return original query on slow response', (done) => {
            api.getSuggestion('test', 'pt', (suggestion) => {
                // Should return original query on timeout (not empty string)
                expect(suggestion).toBe('test');
                done();
            });
        }, 3000); // Allow test to run longer than timeout
    });

    describe('Parameter Handling', () => {
        let api;

        beforeEach(() => {
            api = new SuggestionApiRequest();
            api.apiUrl = `http://localhost:${mockServerPort}`;
            api.enabled = true;
        });

        it('should sanitize request data with query parameter', () => {
            const requestData = new URLSearchParams({
                query: 'test search',
                l: 'en'
            });

            const sanitized = api.sanitizeRequestData(requestData);
            expect(sanitized.get('query')).toBe('test search');
            expect(sanitized.get('l')).toBe('en');
        });

        it('should use default language when not specified', () => {
            const requestData = new URLSearchParams({
                query: 'busca'
            });

            const sanitized = api.sanitizeRequestData(requestData);
            expect(sanitized.get('l')).toBe('pt');
        });
    });
});
