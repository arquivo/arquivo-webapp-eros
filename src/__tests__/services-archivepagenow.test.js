// Mock dependencies before requiring the module
jest.mock('config');
jest.mock('node-fetch');
jest.mock('../logger', () => {
    const logger = { info: jest.fn(), error: jest.fn() };
    return jest.fn(() => logger);
});

const archivePageNow = require('../services-archivepagenow');
const fetch = require('node-fetch');
const config = require('config');
const logger = require('../logger')();

describe('Archive Page Now Service', () => {
    let req, res;
    let mockFetch;

    beforeEach(() => {
        // Setup mock request
        req = {
            body: {},
            get: jest.fn((header) => {
                if (header === 'user-agent') return 'test-user-agent';
                return null;
            }),
            headers: {
                'x-forwarded-for': '192.168.1.1'
            },
            socket: {
                remoteAddress: '127.0.0.1'
            }
        };

        // Setup mock response
        res = {
            render: jest.fn()
        };

        // Setup fetch mock
        mockFetch = jest.fn().mockResolvedValue({});
        fetch.mockImplementation(mockFetch);

        // Clear all mocks
        jest.clearAllMocks();
    });

    describe('Valid URL Processing', () => {
        it('should render success page for valid URL', () => {
            req.body = { url: 'http://example.com' };

            archivePageNow(req, res);

            expect(res.render).toHaveBeenCalledWith('pages/services-archivepagenow-save', 
                expect.objectContaining({
                    url: 'https://preprod.arquivo.pt/services/save/http://example.com',
                    liveUrl: 'http://example.com'
                })
            );
        });

        it('should log successful archiving request to backend', () => {
            req.body = { url: 'http://example.com' };

            archivePageNow(req, res);

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('success=true'),
                expect.objectContaining({ method: 'POST' })
            );
        });

        it('should include user-agent in backend logging', () => {
            req.body = { url: 'http://example.com' };

            archivePageNow(req, res);

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('user-agent=test-user-agent'),
                expect.any(Object)
            );
        });

        it('should include IP address in backend logging', () => {
            req.body = { url: 'http://example.com' };

            archivePageNow(req, res);

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('ip=192.168.1.1'),
                expect.any(Object)
            );
        });

        it('should use socket.remoteAddress when x-forwarded-for is not available', () => {
            req.body = { url: 'http://example.com' };
            req.headers = {}; // Remove x-forwarded-for

            archivePageNow(req, res);

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('ip=127.0.0.1'),
                expect.any(Object)
            );
        });

        it('should include recordingUrl with timestamp in response', () => {
            req.body = { url: 'http://example.com' };

            archivePageNow(req, res);

            expect(res.render).toHaveBeenCalledWith('pages/services-archivepagenow-save',
                expect.objectContaining({
                    recordingUrl: expect.stringMatching(/https:\/\/preprod\.arquivo\.pt\/wayback\/\d{14}\/http:\/\/example\.com/)
                })
            );
        });

        it('should trim whitespace from URL', () => {
            req.body = { url: '  http://example.com  ' };

            archivePageNow(req, res);

            expect(res.render).toHaveBeenCalledWith('pages/services-archivepagenow-save',
                expect.objectContaining({
                    liveUrl: 'http://example.com'
                })
            );
        });

        it('should handle URLs without protocol', () => {
            req.body = { url: 'example.com' };

            archivePageNow(req, res);

            expect(res.render).toHaveBeenCalledWith('pages/services-archivepagenow-save',
                expect.objectContaining({
                    liveUrl: 'example.com'
                })
            );
        });
    });

    describe('Invalid URL Processing', () => {
        it('should render error page for invalid URL', () => {
            req.body = { url: 'not a valid url' };

            archivePageNow(req, res);

            expect(res.render).toHaveBeenCalledWith('pages/services-archivepagenow',
                expect.objectContaining({
                    url: 'not a valid url',
                    error: true,
                    errorType: 'default'
                })
            );
        });

        it('should log failed request for invalid URL', () => {
            req.body = { url: 'invalid url' };

            archivePageNow(req, res);

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('success=false'),
                expect.objectContaining({ method: 'POST' })
            );
        });

        it('should handle empty URL', () => {
            req.body = { url: '' };

            archivePageNow(req, res);

            expect(res.render).toHaveBeenCalledWith('pages/services-archivepagenow',
                expect.objectContaining({
                    error: true
                })
            );
        });

        it('should handle missing URL parameter', () => {
            req.body = {};

            archivePageNow(req, res);

            expect(res.render).toHaveBeenCalledWith('pages/services-archivepagenow',
                expect.objectContaining({
                    error: true
                })
            );
        });
    });

    describe('Error Handling', () => {
        it('should handle fetch errors gracefully without crashing', () => {
            req.body = { url: 'http://example.com' };
            mockFetch.mockRejectedValue(new Error('Network error'));

            expect(() => {
                archivePageNow(req, res);
            }).not.toThrow();
        });

        it('should still render success page even if logging fails', () => {
            req.body = { url: 'http://example.com' };
            mockFetch.mockRejectedValue(new Error('Logging failed'));

            archivePageNow(req, res);

            expect(res.render).toHaveBeenCalledWith('pages/services-archivepagenow-save',
                expect.any(Object)
            );
        });

        // Stubs config's backend.url for every test of the enclosing describe.
        const withBackendUrl = value => {
            beforeEach(() => {
                const realGet = config.get;
                jest.spyOn(config, 'get').mockImplementation(key =>
                    key === 'backend.url' ? value : realGet(key));
            });
            afterEach(() => config.get.mockRestore());
        };

        describe('with a malformed backend.url', () => {
            withBackendUrl('http://user:s3cr3t@bad host');

            it('should render the page and send the error to the app logger instead of throwing', () => {
                req.body = { url: 'http://example.com' };

                expect(() => archivePageNow(req, res)).not.toThrow();

                expect(res.render).toHaveBeenCalledWith('pages/services-archivepagenow-save',
                    expect.any(Object));
                expect(mockFetch).not.toHaveBeenCalled();
                expect(logger.error).toHaveBeenCalledWith('Invalid backend.url configuration');
                // backend.url may carry credentials: its value is never logged.
                const logged = [...logger.info.mock.calls, ...logger.error.mock.calls].flat().join('\n');
                expect(logged).not.toContain('s3cr3t');
                expect(logged).not.toContain('bad host');
            });

            it('should also log the error on the invalid-url branch', () => {
                req.body = { url: 'not a valid url' };

                expect(() => archivePageNow(req, res)).not.toThrow();

                expect(res.render).toHaveBeenCalledWith('pages/services-archivepagenow',
                    expect.objectContaining({ error: true }));
                expect(mockFetch).not.toHaveBeenCalled();
                expect(logger.error).toHaveBeenCalledWith('Invalid backend.url configuration');
            });
        });

        describe('when the logging request is rejected', () => {
            withBackendUrl('http://user:s3cr3t@127.0.0.1:1');

            it('should not log the request URL, credentials, user-agent or IP', async () => {
                // node-fetch 2.x puts the full request URL in FetchError.message.
                const { FetchError } = jest.requireActual('node-fetch');
                mockFetch.mockImplementation(url => Promise.reject(new FetchError(
                    `request to ${url} failed, reason: connect ECONNREFUSED 127.0.0.1:1`,
                    'system', { code: 'ECONNREFUSED', errno: 'ECONNREFUSED' })));
                req.body = { url: 'http://example.com/submitted-page' };
                req.get = jest.fn(() => 'agent-under-test');
                req.headers = { 'x-forwarded-for': '203.0.113.9' };

                archivePageNow(req, res);
                await new Promise(setImmediate);

                expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('s3cr3t'), expect.any(Object));
                expect(logger.error).toHaveBeenCalledTimes(1);
                expect(logger.error).toHaveBeenCalledWith('Backend logging failed - '
                    + 'name: "FetchError", type: "system", errno: "ECONNREFUSED", code: "ECONNREFUSED"');
                const logged = [...logger.info.mock.calls, ...logger.error.mock.calls].flat().join('\n');
                ['s3cr3t', 'agent-under-test', '203.0.113.9']
                    .forEach(value => expect(logged).not.toContain(value));
                // The submitted URL is logged on purpose when the page is accessed,
                // but never as part of the backend request.
                expect(logger.error.mock.calls.flat().join('\n')).not.toContain('submitted-page');
            });
        });

        it('should log a non-URL synchronous error by its name', () => {
            // A lone surrogate makes encodeURIComponent throw a URIError.
            req.body = { url: 'http://example.com' };
            req.get = jest.fn(() => 'agent-\uD800');

            expect(() => archivePageNow(req, res)).not.toThrow();

            expect(mockFetch).not.toHaveBeenCalled();
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('name: "URIError"'));
            expect(logger.error).not.toHaveBeenCalledWith('Invalid backend.url configuration');
        });

        it('should handle special characters in URL', () => {
            req.body = { url: 'http://example.com/path?query=test&value=123' };

            archivePageNow(req, res);

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining(encodeURIComponent('http://example.com/path?query=test&value=123')),
                expect.any(Object)
            );
        });
    });

    describe('Logging', () => {
        it('should encode URL parameters in logging request', () => {
            req.body = { url: 'http://example.com/test?q=hello world' };

            archivePageNow(req, res);

            const fetchCall = mockFetch.mock.calls[0][0];
            expect(fetchCall).toContain(encodeURIComponent('http://example.com/test?q=hello world'));
        });

        it('should encode user-agent in logging request', () => {
            req.body = { url: 'http://example.com' };
            req.get = jest.fn(() => 'Mozilla/5.0 (Test Agent)');

            archivePageNow(req, res);

            const fetchCall = mockFetch.mock.calls[0][0];
            expect(fetchCall).toContain(encodeURIComponent('Mozilla/5.0 (Test Agent)'));
        });

        it('should include logging=true parameter', () => {
            req.body = { url: 'http://example.com' };

            archivePageNow(req, res);

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('logging=true'),
                expect.any(Object)
            );
        });
    });

    // Pins the FULL outgoing logging URL, not just fragments of it. The backend
    // endpoint (POST /services/archivepagenow?logging=...) answers with an empty
    // body: the "log" is the raw request line written to the traffic log, so the
    // exact bytes of the query string matter.
    describe('Logging URL (exact)', () => {
        const endpoint = 'https://preprod.arquivo.pt/services/archivepagenow';
        const loggedUrl = () => mockFetch.mock.calls[0][0];

        it('should log a successful request with every parameter in order', () => {
            req.body = { url: 'http://example.com' };

            archivePageNow(req, res);

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(mockFetch).toHaveBeenCalledWith(
                endpoint + '?url=http%3A%2F%2Fexample.com&success=true&logging=true'
                + '&user-agent=test-user-agent&ip=192.168.1.1',
                { method: 'POST' }
            );
        });

        it('should encode &, ? and # in the archived URL', () => {
            req.body = { url: 'http://example.com/path?a=1&b=2#frag' };

            archivePageNow(req, res);

            expect(loggedUrl()).toBe(endpoint
                + '?url=http%3A%2F%2Fexample.com%2Fpath%3Fa%3D1%26b%3D2%23frag'
                + '&success=true&logging=true&user-agent=test-user-agent&ip=192.168.1.1');
        });

        it('should encode spaces as %20 (not +) on a failed request', () => {
            req.body = { url: 'not a valid url' };

            archivePageNow(req, res);

            expect(loggedUrl()).toBe(endpoint
                + '?url=not%20a%20valid%20url&success=false&logging=true'
                + '&user-agent=test-user-agent&ip=192.168.1.1');
        });

        it('should percent-encode unicode as UTF-8', () => {
            req.body = { url: 'http://exemplo.pt/ação?q=café' };

            archivePageNow(req, res);

            expect(loggedUrl()).toBe(endpoint
                + '?url=http%3A%2F%2Fexemplo.pt%2Fa%C3%A7%C3%A3o%3Fq%3Dcaf%C3%A9'
                + '&success=true&logging=true&user-agent=test-user-agent&ip=192.168.1.1');
        });

        it("should keep ' ( ) ! ~ * literal", () => {
            req.body = { url: "http://example.com/it's(1)!~*" };

            archivePageNow(req, res);

            // node-fetch 2.x still sends ' as %27 on the wire (WHATWG URL normalisation)
            expect(loggedUrl()).toBe(endpoint
                + "?url=http%3A%2F%2Fexample.com%2Fit's(1)!~*"
                + '&success=false&logging=true&user-agent=test-user-agent&ip=192.168.1.1');
        });

        it('should encode a browser user-agent with %20 and literal parentheses', () => {
            req.body = { url: 'http://example.com' };
            req.get = jest.fn(() => 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko)');

            archivePageNow(req, res);

            expect(loggedUrl()).toBe(endpoint
                + '?url=http%3A%2F%2Fexample.com&success=true&logging=true'
                + '&user-agent=Mozilla%2F5.0%20(X11%3B%20Linux%20x86_64)%20AppleWebKit%2F537.36%20(KHTML%2C%20like%20Gecko)'
                + '&ip=192.168.1.1');
        });

        it('should send an empty user-agent parameter when the header is empty', () => {
            req.body = { url: 'http://example.com' };
            req.get = jest.fn(() => '');

            archivePageNow(req, res);

            expect(loggedUrl()).toBe(endpoint
                + '?url=http%3A%2F%2Fexample.com&success=true&logging=true&user-agent=&ip=192.168.1.1');
        });

        it('should send "undefined" when the user-agent header is missing', () => {
            req.body = { url: 'http://example.com' };
            req.get = jest.fn(() => undefined);

            archivePageNow(req, res);

            expect(loggedUrl()).toBe(endpoint
                + '?url=http%3A%2F%2Fexample.com&success=true&logging=true&user-agent=undefined&ip=192.168.1.1');
        });

        it('should encode a multi-hop x-forwarded-for list', () => {
            req.body = { url: 'http://example.com' };
            req.headers = { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' };

            archivePageNow(req, res);

            expect(loggedUrl()).toBe(endpoint
                + '?url=http%3A%2F%2Fexample.com&success=true&logging=true'
                + '&user-agent=test-user-agent&ip=203.0.113.7%2C%2010.0.0.1');
        });

        it('should log an empty url parameter when the url is missing', () => {
            req.body = {};

            archivePageNow(req, res);

            expect(loggedUrl()).toBe(endpoint
                + '?url=&success=false&logging=true&user-agent=test-user-agent&ip=192.168.1.1');
        });
    });

    describe('Request isolation', () => {
        const makeReq = (userAgent, ip) => ({
            body: { url: 'http://example.com' },
            get: jest.fn(() => userAgent),
            headers: { 'x-forwarded-for': ip },
            socket: {}
        });

        it('should not share user-agent or IP between interleaved requests', () => {
            const reqA = makeReq('agent-A', '198.51.100.1');
            const reqB = makeReq('agent-B', '198.51.100.2');
            // Request B is handled while request A is between reading its
            // headers and logging (simulated by re-entering from A's render).
            const resA = { render: jest.fn(() => archivePageNow(reqB, { render: jest.fn() })) };

            archivePageNow(reqA, resA);

            const logged = mockFetch.mock.calls.map(([url]) => {
                const params = new URL(url).searchParams;
                return [params.get('user-agent'), params.get('ip')];
            });
            expect(logged).toEqual([
                ['agent-B', '198.51.100.2'],
                ['agent-A', '198.51.100.1']
            ]);
        });
    });
});
