// Mock config before requiring modules
jest.mock('config');

const SuggestionApiRequest = require('../suggestion-api');
const config = require('config');
const http = require('http');

/**
 * SuggestionApiRequest Test Suite
 * 
 * Comprehensive test coverage for the suggestion API including:
 * - Constructor initialization and configuration
 * - Enabled/disabled state behavior
 * - HTML parsing and suggestion extraction
 * - Timeout handling
 * - HTTP error status codes (4xx, 5xx, 3xx)
 * - Request and response errors
 * - Exception handling
 * - Callback safety (single invocation, null/undefined handling)
 * - Edge cases: empty responses, malformed HTML, special characters, unicode, large payloads
 * - Query parameter handling: special chars, URL encoding, long queries, newlines
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

    describe('Error Handling - Response Errors', () => {
        let errorMockServer;
        let errorMockServerPort;
        let api;

        beforeAll((done) => {
            // Create a mock server that simulates response errors
            errorMockServer = http.createServer((req, res) => {
                // Send partial response then emit error
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.write('<div id="correction">');
                // Force a response stream error
                res.destroy(new Error('Response stream error'));
            });

            errorMockServer.listen(0, () => {
                errorMockServerPort = errorMockServer.address().port;
                done();
            });
        });

        afterAll((done) => {
            errorMockServer.close(done);
        });

        beforeEach(() => {
            api = new SuggestionApiRequest();
            api.apiUrl = `http://localhost:${errorMockServerPort}`;
            api.enabled = true;
        });

        it('should handle response errors and return original query', (done) => {
            api.getSuggestion('test', 'pt', (suggestion) => {
                expect(suggestion).toBe('test');
                done();
            });
        });
    });

    describe('Error Handling - Request Errors', () => {
        let api;

        beforeEach(() => {
            api = new SuggestionApiRequest();
            api.enabled = true;
        });

        it('should handle request errors (invalid host) and return original query', (done) => {
            // Use an invalid host to trigger request error
            api.apiUrl = 'http://invalid-host-that-does-not-exist-12345.local';
            
            api.getSuggestion('test', 'pt', (suggestion) => {
                expect(suggestion).toBe('test');
                done();
            });
        }, 5000);

        it('should handle request errors (connection refused) and return original query', (done) => {
            // Use a port that's not listening to trigger connection refused
            api.apiUrl = 'http://localhost:1';
            
            api.getSuggestion('test', 'pt', (suggestion) => {
                expect(suggestion).toBe('test');
                done();
            });
        }, 5000);
    });

    describe('Error Handling - Exception in get()', () => {
        let api;

        beforeEach(() => {
            api = new SuggestionApiRequest();
            api.apiUrl = `http://localhost:${mockServerPort}`;
            api.enabled = true;
        });

        it('should handle exceptions in get() and return original query', (done) => {
            // Force an exception by making apiUrl invalid after construction
            api.apiUrl = 'not-a-valid-url';
            
            api.getSuggestion('test', 'pt', (suggestion) => {
                expect(suggestion).toBe('test');
                done();
            });
        });
    });

    describe('Error Handling - Non-2xx Status Codes', () => {
        let errorStatusMockServer;
        let errorStatusMockServerPort;
        let api;

        beforeAll((done) => {
            // Create a mock server that returns various HTTP error codes
            errorStatusMockServer = http.createServer((req, res) => {
                const url = new URL(req.url, `http://localhost:${errorStatusMockServerPort}`);
                const query = url.searchParams.get('query');
                
                // Return different status codes based on query
                if (query === '404-test') {
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    res.end('Not Found');
                } else if (query === '500-test') {
                    res.writeHead(500, { 'Content-Type': 'text/html' });
                    res.end('Internal Server Error');
                } else if (query === '301-test') {
                    res.writeHead(301, { 'Content-Type': 'text/html', 'Location': 'http://example.com' });
                    res.end();
                } else {
                    res.writeHead(503, { 'Content-Type': 'text/html' });
                    res.end('Service Unavailable');
                }
            });

            errorStatusMockServer.listen(0, () => {
                errorStatusMockServerPort = errorStatusMockServer.address().port;
                done();
            });
        });

        afterAll((done) => {
            errorStatusMockServer.close(done);
        });

        beforeEach(() => {
            api = new SuggestionApiRequest();
            api.apiUrl = `http://localhost:${errorStatusMockServerPort}`;
            api.enabled = true;
        });

        it('should handle 404 status code and return original query', (done) => {
            api.getSuggestion('404-test', 'pt', (suggestion) => {
                expect(suggestion).toBe('404-test');
                done();
            });
        });

        it('should handle 500 status code and return original query', (done) => {
            api.getSuggestion('500-test', 'pt', (suggestion) => {
                expect(suggestion).toBe('500-test');
                done();
            });
        });

        it('should handle 3xx redirect status code and return original query', (done) => {
            api.getSuggestion('301-test', 'pt', (suggestion) => {
                expect(suggestion).toBe('301-test');
                done();
            });
        });

        it('should handle 503 status code and return original query', (done) => {
            api.getSuggestion('unavailable-test', 'pt', (suggestion) => {
                expect(suggestion).toBe('unavailable-test');
                done();
            });
        });
    });

    describe('Edge Cases - Callback Safety', () => {
        let api;

        beforeEach(() => {
            api = new SuggestionApiRequest();
            api.apiUrl = `http://localhost:${mockServerPort}`;
            api.enabled = true;
        });

        it('should call callback only once even with response error', (done) => {
            let callCount = 0;
            
            // Use invalid host to trigger error
            api.apiUrl = 'http://localhost:1';
            
            api.getSuggestion('test', 'pt', (suggestion) => {
                callCount++;
                expect(callCount).toBe(1);
                expect(suggestion).toBe('test');
                
                // Small delay to ensure no double callback
                setTimeout(() => {
                    expect(callCount).toBe(1);
                    done();
                }, 100);
            });
        });

        it('should handle missing callback gracefully', () => {
            // Should not throw when callback is undefined
            expect(() => {
                api.getSuggestion('test', 'pt');
            }).not.toThrow();
        });

        it('should handle null callback gracefully', () => {
            // Should not throw when callback is null
            expect(() => {
                api.getSuggestion('test', 'pt', null);
            }).not.toThrow();
        });
    });

    describe('Edge Cases - Response Data', () => {
        let edgeCaseMockServer;
        let edgeCaseMockServerPort;
        let api;

        beforeAll((done) => {
            // Create a mock server for edge case responses
            edgeCaseMockServer = http.createServer((req, res) => {
                const url = new URL(req.url, `http://localhost:${edgeCaseMockServerPort}`);
                const query = url.searchParams.get('query');
                
                if (query === 'empty-response') {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end('');
                } else if (query === 'malformed-html') {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end('<div id="correction"><em>unclosed tag');
                } else if (query === 'special-chars') {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end('<div id="correction"><em>special & chars < > "</em></div>');
                } else if (query === 'unicode') {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end('<div id="correction"><em>português 日本語 emoji 🎉</em></div>');
                } else if (query === 'very-large') {
                    // Simulate a very large response
                    const largeData = 'x'.repeat(100000);
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(`<div id="correction"><em>${largeData}</em></div>`);
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end('<div id="correction"><em>default</em></div>');
                }
            });

            edgeCaseMockServer.listen(0, () => {
                edgeCaseMockServerPort = edgeCaseMockServer.address().port;
                done();
            });
        });

        afterAll((done) => {
            edgeCaseMockServer.close(done);
        });

        beforeEach(() => {
            api = new SuggestionApiRequest();
            api.apiUrl = `http://localhost:${edgeCaseMockServerPort}`;
            api.enabled = true;
        });

        it('should handle empty response body and return original query', (done) => {
            api.getSuggestion('empty-response', 'pt', (suggestion) => {
                expect(suggestion).toBe('empty-response');
                done();
            });
        });

        it('should handle malformed HTML and return original query when no match', (done) => {
            api.getSuggestion('malformed-html', 'pt', (suggestion) => {
                // When HTML is malformed and no proper <em> tag found, return original
                expect(suggestion).toBe('malformed-html');
                done();
            });
        });

        it('should handle special HTML characters in suggestion', (done) => {
            api.getSuggestion('special-chars', 'pt', (suggestion) => {
                expect(suggestion).toBe('special & chars < > "');
                done();
            });
        });

        it('should handle unicode and emoji in suggestion', (done) => {
            api.getSuggestion('unicode', 'pt', (suggestion) => {
                expect(suggestion).toBe('português 日本語 emoji 🎉');
                done();
            });
        });

        it('should handle very large response', (done) => {
            api.getSuggestion('very-large', 'pt', (suggestion) => {
                expect(suggestion.length).toBeGreaterThan(90000);
                expect(suggestion).toMatch(/^x+$/);
                done();
            });
        }, 10000);
    });

    describe('Edge Cases - Query Parameters', () => {
        let api;

        beforeEach(() => {
            api = new SuggestionApiRequest();
            api.apiUrl = `http://localhost:${mockServerPort}`;
            api.enabled = true;
        });

        it('should handle query with special characters', (done) => {
            api.getSuggestion('test & query = value', 'pt', (suggestion) => {
                expect(suggestion).toContain('suggestion');
                done();
            });
        });

        it('should handle query with URL-encoded characters', (done) => {
            api.getSuggestion('test%20query', 'pt', (suggestion) => {
                expect(suggestion).toContain('suggestion');
                done();
            });
        });

        it('should handle very long query', (done) => {
            const longQuery = 'a'.repeat(1000);
            api.getSuggestion(longQuery, 'pt', (suggestion) => {
                expect(typeof suggestion).toBe('string');
                done();
            });
        });

        it('should handle query with newlines', (done) => {
            api.getSuggestion('test\nquery\nwith\nnewlines', 'pt', (suggestion) => {
                expect(suggestion).toContain('suggestion');
                done();
            });
        });

        it('should handle unsupported language code', (done) => {
            api.getSuggestion('test', 'invalid-lang', (suggestion) => {
                expect(typeof suggestion).toBe('string');
                done();
            });
        });
    });
});
