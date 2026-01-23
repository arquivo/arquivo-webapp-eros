// Mock dependencies before requiring the module
jest.mock('config');
jest.mock('node-fetch');

const archivePageNow = require('../services-archivepagenow');
const fetch = require('node-fetch');

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
});
