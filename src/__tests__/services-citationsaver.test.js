'use strict';

jest.mock('config');
jest.mock('node-fetch');
jest.mock('fs');
jest.mock('../spreadsheet-client');
jest.mock('../utils/is-valid-url');
jest.mock('dns');

const servicesCitationSaver = require('../services-citationsaver');
const fetch = require('node-fetch');
const fs = require('fs');
const addToSpreadsheet = require('../spreadsheet-client');
const dns = require('dns');
const isValidUrl = require('../utils/is-valid-url');

const flushPromises = async () => {
    for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve));
};

describe('Citation Saver Service', () => {
    let req, res;
    let mockFetch;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            body: {},
            files: null,
            t: jest.fn((key) => key)
        };

        res = {
            send: jest.fn()
        };

        // Setup mocks
        mockFetch = jest.fn().mockResolvedValue({
            ok: true,
            headers: new Map([
                ['content-type', 'application/pdf'],
                ['content-length', '5000']
            ])
        });
        fetch.mockImplementation(mockFetch);

        // Mock fs
        fs.writeFile.mockImplementation((path, data, cb) => cb(null));
        fs.unlink.mockImplementation((path, cb) => cb && cb(null));

        isValidUrl.mockReturnValue(true);
        addToSpreadsheet.mockResolvedValue();

        // Resolve to a public IP so isSsrfTarget() passes by default
        dns.lookup.mockImplementation((hostname, opts, cb) => cb(null, [{ address: '93.184.216.34', family: 4 }]));
    });

    describe('File upload handling', () => {
        it('accepts valid PDF file upload', () => {
            req.body = { email: 'test@example.com' };
            req.files = {
                file: {
                    name: 'document.pdf',
                    mimetype: 'application/pdf',
                    size: 10000,
                    mv: jest.fn()
                }
            };

            servicesCitationSaver(req, res);

            expect(res.send).toHaveBeenCalledWith({
                status: true,
                message: 'File uploaded',
                data: expect.objectContaining({
                    name: 'document.pdf',
                    mimetype: 'application/pdf',
                    size: 10000
                })
            });
        });

        it('accepts valid TXT file upload', () => {
            req.body = { email: 'test@example.com' };
            req.files = {
                file: {
                    name: 'notes.txt',
                    mimetype: 'text/plain',
                    size: 5000,
                    mv: jest.fn()
                }
            };

            servicesCitationSaver(req, res);

            expect(res.send).toHaveBeenCalledWith({
                status: true,
                message: 'File uploaded',
                data: expect.objectContaining({
                    name: 'notes.txt',
                    mimetype: 'text/plain'
                })
            });
        });

        it('accepts valid HTML file upload', () => {
            req.body = { email: 'test@example.com' };
            req.files = {
                file: {
                    name: 'page.html',
                    mimetype: 'text/html',
                    size: 3000,
                    mv: jest.fn()
                }
            };

            servicesCitationSaver(req, res);

            expect(res.send).toHaveBeenCalledWith({
                status: true,
                message: 'File uploaded',
                data: expect.any(Object)
            });
        });

        it('rejects file with unsupported MIME type', () => {
            req.body = { email: 'test@example.com' };
            req.files = {
                file: {
                    name: 'document.docx',
                    mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    size: 5000,
                    mv: jest.fn()
                }
            };

            servicesCitationSaver(req, res);

            expect(res.send).toHaveBeenCalledWith({
                status: false,
                message: 'services-citation-saver.errors.file.mimetype'
            });
        });

        it('rejects file exceeding size limit', () => {
            req.body = { email: 'test@example.com' };
            req.files = {
                file: {
                    name: 'large.pdf',
                    mimetype: 'application/pdf',
                    size: 200000000,
                    mv: jest.fn()
                }
            };

            servicesCitationSaver(req, res);

            expect(res.send).toHaveBeenCalledWith({
                status: false,
                message: 'services-citation-saver.errors.file.filesize'
            });
        });

        it('rejects when no file is provided', () => {
            // req.body.file makes the outer condition enter handleFile,
            // but req.files=null triggers the missing-file guard inside it
            req.body = { email: 'test@example.com', file: true };
            req.files = null;

            servicesCitationSaver(req, res);

            expect(res.send).toHaveBeenCalledWith({
                status: false,
                message: 'services-citation-saver.errors.file.missing'
            });
        });

        it('calls file move method with generated path', () => {
            const mockMv = jest.fn();
            req.body = { email: 'test@example.com' };
            req.files = {
                file: {
                    name: 'document.pdf',
                    mimetype: 'application/pdf',
                    size: 5000,
                    mv: mockMv
                }
            };

            servicesCitationSaver(req, res);

            expect(mockMv).toHaveBeenCalledWith(
                expect.stringContaining('uploads/CitationSaver/')
            );
        });
    });

    describe('URL submission handling', () => {
        it('accepts valid URL submission', async () => {
            req.body = { url: 'http://example.com', email: 'test@example.com' };

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(res.send).toHaveBeenCalledWith({
                status: true,
                message: 'Link uploaded',
                data: expect.objectContaining({
                    name: 'http://example.com'
                })
            });
        });

        it('rejects invalid URL synchronously', () => {
            isValidUrl.mockReturnValue(false);
            req.body = { url: 'not a valid url', email: 'test@example.com' };

            servicesCitationSaver(req, res);

            expect(res.send).toHaveBeenCalledWith({
                status: false,
                message: 'services-citation-saver.errors.URL.invalid'
            });
        });

        it('rejects URL resolving to a private IP (SSRF)', async () => {
            dns.lookup.mockImplementationOnce((hostname, opts, cb) => cb(null, [{ address: '192.168.1.1', family: 4 }]));
            req.body = { url: 'http://internal.example.com', email: 'test@example.com' };

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(res.send).toHaveBeenCalledWith({
                status: false,
                message: 'services-citation-saver.errors.URL.invalid'
            });
        });

        it('disables redirect following to prevent redirect-to-private bypass', async () => {
            req.body = { url: 'http://example.com', email: 'test@example.com' };

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ redirect: 'error' })
            );
        });

        it('validates URL accessibility with HEAD request', async () => {
            req.body = { url: 'http://example.com', email: 'test@example.com' };

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(mockFetch).toHaveBeenCalledWith(
                'http://example.com',
                expect.objectContaining({ method: 'HEAD' })
            );
        });

        it('adds https:// prefix when URL lacks protocol', async () => {
            req.body = { url: 'example.com', email: 'test@example.com' };

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(mockFetch).toHaveBeenCalledWith(
                'https://example.com',
                expect.any(Object)
            );
        });

        it('rejects URL when fetch returns non-ok status', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                headers: new Map()
            });
            req.body = { url: 'http://example.com', email: 'test@example.com' };

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(res.send).toHaveBeenCalledWith({
                status: false,
                message: 'services-citation-saver.errors.URL.invalid'
            });
        });

        it('rejects URL with unsupported content type', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                headers: new Map([
                    ['content-type', 'application/json'],
                    ['content-length', '1000']
                ])
            });
            req.body = { url: 'http://example.com/api', email: 'test@example.com' };

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(res.send).toHaveBeenCalledWith({
                status: false,
                message: 'services-citation-saver.errors.URL.mimetype'
            });
        });

        it('rejects URL with content exceeding size limit', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                headers: new Map([
                    ['content-type', 'application/pdf'],
                    ['content-length', '200000000']
                ])
            });
            req.body = { url: 'http://example.com/large.pdf', email: 'test@example.com' };

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(res.send).toHaveBeenCalledWith({
                status: false,
                message: 'services-citation-saver.errors.URL.filesize'
            });
        });

        it('writes .link file with URL content', async () => {
            req.body = { url: 'http://example.com', email: 'test@example.com' };

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(fs.writeFile).toHaveBeenCalledWith(
                expect.stringContaining('.link'),
                'http://example.com',
                expect.any(Function)
            );
        });
    });

    describe('Text submission handling', () => {
        it('accepts valid text submission', () => {
            req.body = { text: 'Sample citation text', email: 'test@example.com' };

            servicesCitationSaver(req, res);

            expect(res.send).toHaveBeenCalledWith({
                status: true,
                message: 'Text uploaded',
                data: expect.objectContaining({
                    mimetype: 'text/plain',
                    size: 20
                })
            });
        });

        it('rejects text exceeding size limit', () => {
            const largeText = 'x'.repeat(200000000);
            req.body = { text: largeText, email: 'test@example.com' };

            servicesCitationSaver(req, res);

            expect(res.send).toHaveBeenCalledWith({
                status: false,
                message: 'services-citation-saver.errors.text.filesize'
            });
        });

        it('writes .txt file with text content', () => {
            req.body = { text: 'Sample text', email: 'test@example.com' };

            servicesCitationSaver(req, res);

            expect(fs.writeFile).toHaveBeenCalledWith(
                expect.stringContaining('.txt'),
                'Sample text',
                expect.any(Function)
            );
        });

        it('saves text without email when email is missing', () => {
            req.body = { text: 'Sample text' };

            servicesCitationSaver(req, res);

            expect(res.send).toHaveBeenCalledWith({
                status: true,
                message: 'Text uploaded',
                data: expect.any(Object)
            });
        });
    });

    describe('Malformed request handling', () => {
        it('rejects empty body', () => {
            req.body = {};
            req.files = null;

            servicesCitationSaver(req, res);

            expect(res.send).toHaveBeenCalledWith({
                status: false,
                message: 'services-citation-saver.errors.empty'
            });
        });

        it('prioritizes URL over file when both present', async () => {
            req.body = { url: 'http://example.com' };
            req.files = {
                file: {
                    name: 'document.pdf',
                    mimetype: 'application/pdf',
                    size: 5000,
                    mv: jest.fn()
                }
            };

            servicesCitationSaver(req, res);
            await flushPromises();

            // req.body.url is checked first in the source
            expect(res.send).toHaveBeenCalledWith({
                status: true,
                message: 'Link uploaded',
                data: expect.any(Object)
            });
        });

        it('prioritizes URL over text when both present', async () => {
            req.body = { url: 'http://example.com', text: 'text content' };

            servicesCitationSaver(req, res);
            await flushPromises();

            // URL handler is called (checks req.body.url before req.body.text)
            expect(res.send).toHaveBeenCalledWith({
                status: true,
                message: 'Link uploaded',
                data: expect.any(Object)
            });
        });
    });

    describe('Error handling', () => {
        it('handles fetch rejection gracefully', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));
            req.body = { url: 'http://example.com', email: 'test@example.com' };

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(res.send).toHaveBeenCalledWith({
                status: false,
                message: 'services-citation-saver.errors.default'
            });
        });

        it('handles file write errors gracefully', () => {
            fs.writeFile.mockImplementationOnce((path, data, cb) => {
                cb(new Error('Write failed'));
            });
            req.body = { text: 'Sample text', email: 'test@example.com' };

            expect(() => {
                servicesCitationSaver(req, res);
            }).not.toThrow();
        });

        it('handles unexpected errors gracefully', () => {
            req.body = { url: null }; // Malformed request

            expect(() => {
                servicesCitationSaver(req, res);
            }).not.toThrow();
        });
    });

    describe('SSRF protection — isSsrfTarget branches', () => {
        it('blocks when any resolved address is private (multi-address DNS)', async () => {
            dns.lookup.mockImplementationOnce((hostname, opts, cb) => cb(null, [
                { address: '93.184.216.34', family: 4 },
                { address: '10.0.0.1', family: 4 }
            ]));
            req.body = { url: 'http://split-horizon.example.com', email: 'test@example.com' };

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(res.send).toHaveBeenCalledWith({
                status: false,
                message: 'services-citation-saver.errors.URL.invalid'
            });
        });

        it('blocks URL with non-http/https scheme (file://) via isValidUrl', async () => {
            isValidUrl.mockReturnValueOnce(false);
            req.body = { url: 'file:///etc/passwd', email: 'test@example.com' };

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(res.send).toHaveBeenCalledWith({
                status: false,
                message: 'services-citation-saver.errors.URL.invalid'
            });
        });

        it('blocks when DNS lookup returns an error', async () => {
            dns.lookup.mockImplementationOnce((hostname, opts, cb) => cb(new Error('ENOTFOUND')));
            req.body = { url: 'http://nonexistent.example.com', email: 'test@example.com' };

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(res.send).toHaveBeenCalledWith({
                status: false,
                message: 'services-citation-saver.errors.URL.invalid'
            });
        });

        it('blocks URL with IP literal resolving to loopback (127.0.0.1)', async () => {
            req.body = { url: 'http://127.0.0.1/secret', email: 'test@example.com' };

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(res.send).toHaveBeenCalledWith({
                status: false,
                message: 'services-citation-saver.errors.URL.invalid'
            });
        });

        it('blocks URL with IP literal in 10.x.x.x range', async () => {
            req.body = { url: 'http://10.0.0.1/secret', email: 'test@example.com' };

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(res.send).toHaveBeenCalledWith({
                status: false,
                message: 'services-citation-saver.errors.URL.invalid'
            });
        });

        it('blocks URL with IP literal in 172.16.x.x range', async () => {
            req.body = { url: 'http://172.16.0.1/secret', email: 'test@example.com' };

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(res.send).toHaveBeenCalledWith({
                status: false,
                message: 'services-citation-saver.errors.URL.invalid'
            });
        });

        it('blocks URL with cloud metadata IP (169.254.169.254)', async () => {
            req.body = { url: 'http://169.254.169.254/latest/meta-data', email: 'test@example.com' };

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(res.send).toHaveBeenCalledWith({
                status: false,
                message: 'services-citation-saver.errors.URL.invalid'
            });
        });

        it('allows URL with public IP literal (8.8.8.8)', async () => {
            req.body = { url: 'http://8.8.8.8/', email: 'test@example.com' };

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(res.send).toHaveBeenCalledWith({
                status: true,
                message: 'Link uploaded',
                data: expect.any(Object)
            });
        });

        it('blocks URL with IPv6 loopback (::1)', async () => {
            dns.lookup.mockImplementationOnce((hostname, opts, cb) => cb(null, [{ address: '::1', family: 6 }]));
            req.body = { url: 'http://internal.example.com', email: 'test@example.com' };

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(res.send).toHaveBeenCalledWith({
                status: false,
                message: 'services-citation-saver.errors.URL.invalid'
            });
        });

        it('blocks URL with IPv6 ULA address (fc00::/7)', async () => {
            dns.lookup.mockImplementationOnce((hostname, opts, cb) => cb(null, [{ address: 'fc00::1', family: 6 }]));
            req.body = { url: 'http://internal.example.com', email: 'test@example.com' };

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(res.send).toHaveBeenCalledWith({
                status: false,
                message: 'services-citation-saver.errors.URL.invalid'
            });
        });

        it('allows URL with public IPv6 address', async () => {
            dns.lookup.mockImplementationOnce((hostname, opts, cb) => cb(null, [{ address: '2001:4860:4860::8888', family: 6 }]));
            req.body = { url: 'http://ipv6.example.com', email: 'test@example.com' };

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(res.send).toHaveBeenCalledWith({
                status: true,
                message: 'Link uploaded',
                data: expect.any(Object)
            });
        });

        it('blocks DNS resolving to 127.x.x.x', async () => {
            dns.lookup.mockImplementationOnce((hostname, opts, cb) => cb(null, [{ address: '127.0.0.1', family: 4 }]));
            req.body = { url: 'http://loopback.example.com', email: 'test@example.com' };

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(res.send).toHaveBeenCalledWith({
                status: false,
                message: 'services-citation-saver.errors.URL.invalid'
            });
        });

        it('blocks DNS resolving to 10.x.x.x', async () => {
            dns.lookup.mockImplementationOnce((hostname, opts, cb) => cb(null, [{ address: '10.1.2.3', family: 4 }]));
            req.body = { url: 'http://internal.example.com', email: 'test@example.com' };

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(res.send).toHaveBeenCalledWith({
                status: false,
                message: 'services-citation-saver.errors.URL.invalid'
            });
        });

        it('blocks DNS resolving to 169.254.x.x (cloud metadata)', async () => {
            dns.lookup.mockImplementationOnce((hostname, opts, cb) => cb(null, [{ address: '169.254.169.254', family: 4 }]));
            req.body = { url: 'http://metadata.example.com', email: 'test@example.com' };

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(res.send).toHaveBeenCalledWith({
                status: false,
                message: 'services-citation-saver.errors.URL.invalid'
            });
        });
        it('blocks DNS resolving to IPv4-mapped IPv6 private address (::ffff:192.168.1.1)', async () => {
            dns.lookup.mockImplementationOnce((hostname, opts, cb) => cb(null, [{ address: '::ffff:192.168.1.1', family: 6 }]));
            req.body = { url: 'http://internal.example.com', email: 'test@example.com' };

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(res.send).toHaveBeenCalledWith({
                status: false,
                message: 'services-citation-saver.errors.URL.invalid'
            });
        });

        it('blocks DNS resolving to IPv6 link-local address (fe80::/10)', async () => {
            dns.lookup.mockImplementationOnce((hostname, opts, cb) => cb(null, [{ address: 'fe80::1', family: 6 }]));
            req.body = { url: 'http://internal.example.com', email: 'test@example.com' };

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(res.send).toHaveBeenCalledWith({
                status: false,
                message: 'services-citation-saver.errors.URL.invalid'
            });
        });

    });

    describe('Spreadsheet logging', () => {
        it('attempts to log file upload to spreadsheet', async () => {
            req.body = { email: 'test@example.com' };
            req.files = {
                file: {
                    name: 'document.pdf',
                    mimetype: 'application/pdf',
                    size: 5000,
                    mv: jest.fn()
                }
            };

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(addToSpreadsheet).toHaveBeenCalled();
        });

        it('logs URL submission to spreadsheet', async () => {
            req.body = { url: 'http://example.com', email: 'test@example.com' };

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(addToSpreadsheet).toHaveBeenCalled();
        });
    });
});
