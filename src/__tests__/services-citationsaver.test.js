'use strict';

jest.mock('config');
jest.mock('node-fetch');
jest.mock('fs');
jest.mock('../spreadsheet-client');
jest.mock('../utils/is-valid-url');
jest.mock('node:dns');

const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
jest.mock('../logger', () => () => mockLogger);

const { Readable } = require('node:stream');
const servicesCitationSaver = require('../services-citationsaver');
const fetch = require('node-fetch');
const fs = require('fs');
const addToSpreadsheet = require('../spreadsheet-client');
const dns = require('node:dns');
const isValidUrl = require('../utils/is-valid-url');

// jest's automock of 'fs' does not include the fs.promises getter, so provide it explicitly.
fs.promises = { mkdir: jest.fn(), writeFile: jest.fn(), rm: jest.fn() };

// The bytes of an uploaded PDF must contain the PDF magic (#177).
const PDF_DATA = Buffer.from('%PDF-1.4\n%%EOF\n');

// Makes fs.createReadStream() read `data` as the uploaded temporary file.
function uploadedBytes(data) {
    fs.createReadStream.mockImplementation((path, { start = 0, end = Infinity } = {}) =>
        Readable.from([data.subarray(start, end + 1)]));
}

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
        res.status = jest.fn(() => res);

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
        fs.promises.mkdir.mockResolvedValue(undefined);
        fs.promises.writeFile.mockResolvedValue(undefined);
        fs.promises.rm.mockResolvedValue(undefined);
        uploadedBytes(PDF_DATA);

        isValidUrl.mockReturnValue(true);
        addToSpreadsheet.mockResolvedValue();

        // Resolve to a public IP so isSsrfTarget() passes by default
        dns.lookup.mockImplementation((hostname, opts, cb) => cb(null, [{ address: '93.184.216.34', family: 4 }]));
    });

    describe('File upload handling', () => {
        it('accepts valid PDF file upload', async () => {
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
            await flushPromises();

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

        it('accepts valid TXT file upload', async () => {
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
            await flushPromises();

            expect(res.send).toHaveBeenCalledWith({
                status: true,
                message: 'File uploaded',
                data: expect.objectContaining({
                    name: 'notes.txt',
                    mimetype: 'text/plain'
                })
            });
        });

        it('accepts valid HTML file upload', async () => {
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
            await flushPromises();

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

        it('calls file move method with generated path', async () => {
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
            await flushPromises();

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

        it('does not leak mimetype or filesize into the global scope (#56)', async () => {
            req.body = { url: 'http://example.com', email: 'test@example.com' };

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ status: true }));
            expect(globalThis).not.toHaveProperty('mimetype');
            expect(globalThis).not.toHaveProperty('filesize');
        });

        it('writes .link file with URL content', async () => {
            req.body = { url: 'http://example.com', email: 'test@example.com' };

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(fs.promises.writeFile).toHaveBeenCalledWith(
                expect.stringContaining('.link'),
                'http://example.com'
            );
        });
    });

    describe('Text submission handling', () => {
        it('accepts valid text submission', async () => {
            req.body = { text: 'Sample citation text', email: 'test@example.com' };

            servicesCitationSaver(req, res);
            await flushPromises();

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

            expect(res.status).toHaveBeenCalledWith(413);
            expect(res.send).toHaveBeenCalledWith({
                status: false,
                message: 'services-citation-saver.errors.text.filesize'
            });
        });

        it.each([
            ['an array (field sent twice)', ['first', 'second']],
            ['an object', { a: 'b' }]
        ])('rejects text that is %s without storing it', async (kind, text) => {
            req.body = { text, email: 'test@example.com' };

            await servicesCitationSaver(req, res);

            expect(fs.promises.writeFile).not.toHaveBeenCalled();
            expect(addToSpreadsheet).not.toHaveBeenCalled();
            expect(res.send).toHaveBeenCalledTimes(1);
            expect(res.send).toHaveBeenCalledWith({
                status: false,
                message: 'services-citation-saver.errors.default'
            });
        });

        it('moves a text file part to a .txt file', async () => {
            const mv = jest.fn().mockResolvedValue();
            req.body = { email: 'test@example.com' };
            req.files = { text: { name: 'text.txt', mimetype: 'text/plain', size: 11, tempFilePath: '/tmp/x', truncated: false, mv } };
            uploadedBytes(Buffer.from('Sample text'));

            await servicesCitationSaver(req, res);

            expect(mv).toHaveBeenCalledWith(expect.stringMatching(/\.txt$/));
            expect(res.send).toHaveBeenCalledWith({
                status: true,
                message: 'Text uploaded',
                data: { name: '', mimetype: 'text/plain', size: 11 }
            });
        });

        it('rejects a text file part that was cut off at the limit', async () => {
            const mv = jest.fn();
            req.files = { text: { name: 'text.txt', mimetype: 'text/plain', size: 100, tempFilePath: '/tmp/x', truncated: true, mv } };

            await servicesCitationSaver(req, res);

            expect(mv).not.toHaveBeenCalled();
            expect(res.send).toHaveBeenCalledWith({
                status: false,
                message: 'services-citation-saver.errors.text.filesize'
            });
        });

        it('writes .txt file with text content', async () => {
            req.body = { text: 'Sample text', email: 'test@example.com' };

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(fs.promises.writeFile).toHaveBeenCalledWith(
                expect.stringContaining('.txt'),
                'Sample text'
            );
        });

        it('saves text without email when email is missing', async () => {
            req.body = { text: 'Sample text' };

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(res.send).toHaveBeenCalledWith({
                status: true,
                message: 'Text uploaded',
                data: expect.any(Object)
            });
        });
    });

    describe('Email and URL checks (#177)', () => {
        it.each([
            ['an email over 254 characters', { text: 'x', email: 'a'.repeat(255) }, 'services-citation-saver.errors.email.invalid'],
            ['an email that is not a string', { text: 'x', email: ['a@b.pt', 'c@d.pt'] }, 'services-citation-saver.errors.email.invalid'],
            ['a URL over 8192 characters', { url: 'https://example.com/' + 'a'.repeat(8192) }, 'services-citation-saver.errors.URL.invalid'],
            ['a URL that is not a string', { url: { href: 'https://example.com/' } }, 'services-citation-saver.errors.URL.invalid'],
        ])('replies 400 for %s before logging or storing anything', async (_case, body, message) => {
            req.body = body;

            await servicesCitationSaver(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.send).toHaveBeenCalledWith({ status: false, message });
            expect(mockLogger.info).toHaveBeenCalledTimes(1);
            expect(mockLogger.info.mock.calls[0][0]).not.toContain('aaaa');
            expect(fetch).not.toHaveBeenCalled();
            expect(fs.promises.writeFile).not.toHaveBeenCalled();
            expect(addToSpreadsheet).not.toHaveBeenCalled();
        });

        it('accepts a null email', async () => {
            req.body = { text: 'Sample text', email: null };

            await servicesCitationSaver(req, res);

            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ status: true }));
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

    describe('Content sniffing (#177)', () => {
        const submit = async (mimetype, data) => {
            uploadedBytes(data);
            req.files = { file: { name: 'upload', mimetype, size: data.length, tempFilePath: '/tmp/upload', mv: jest.fn() } };
            servicesCitationSaver(req, res);
            await flushPromises();
        };

        it.each([
            ['application/pdf', 'HTML', Buffer.from('<!doctype html><script>alert(1)</script>')],
            ['application/pdf', 'an executable', Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03])],
            ['application/pdf', 'the magic after the first 1024 bytes', Buffer.concat([Buffer.alloc(1020, ' '), Buffer.from('%PDF-1.4\n')])],
            ['application/pdf', 'a file shorter than the magic', Buffer.from('%PDF')],
            ['application/pdf', 'an empty file', Buffer.alloc(0)],
            ['text/plain', 'a NUL byte', Buffer.from('abc\u0000def')],
            ['text/plain', 'UTF-16', Buffer.from('\ufeffhello', 'utf16le')],
            ['text/html', 'a NUL byte', Buffer.from('<p>a\u0000b</p>')],
        ])('rejects a %s file with %s', async (mimetype, label, data) => {
            await submit(mimetype, data);

            expect(res.send).toHaveBeenCalledWith({ status: false, message: 'services-citation-saver.errors.file.mimetype' });
            expect(req.files.file.mv).not.toHaveBeenCalled();
            expect(addToSpreadsheet).not.toHaveBeenCalled();
        });

        it.each([
            ['application/pdf', 'the magic at the start', PDF_DATA],
            ['application/pdf', 'the magic after leading bytes', Buffer.concat([Buffer.alloc(1000, ' '), PDF_DATA])],
            ['text/plain', 'UTF-8 with accents and emoji', Buffer.from('Citações — 📚 https://arquivo.pt')],
            ['text/plain', 'a UTF-8 BOM', Buffer.from('\ufeffhello')],
            ['text/plain', 'Windows-1252 bytes', Buffer.from('Cita\xe7\xf5es \x93aspas\x94', 'latin1')],
            ['text/plain', 'no bytes', Buffer.alloc(0)],
            ['text/html', 'ISO-8859-1 HTML', Buffer.from('<p>Ol\xe1</p>', 'latin1')],
        ])('accepts a %s file with %s', async (mimetype, label, data) => {
            await submit(mimetype, data);

            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ status: true }));
            expect(req.files.file.mv).toHaveBeenCalledTimes(1);
        });

        it('reads only the first 1024 bytes of a PDF', async () => {
            await submit('application/pdf', PDF_DATA);

            expect(fs.createReadStream).toHaveBeenCalledWith('/tmp/upload', { start: 0, end: 1023 });
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

    describe('Upload filenames', () => {
        const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
        const email = 'test@example.com';
        const mv = jest.fn();
        const file = (name, mimetype) => ({ file: { name, mimetype, size: 5000, mv } });

        it.each([
            ['File', 'pdf', { email }, file('doc.pdf', 'application/pdf'), 'doc.pdf'],
            ['File', 'html', { email }, file('page.html', 'text/html'), 'page.html'],
            ['Link', 'link', { email, url: 'http://example.com' }, null, 'http://example.com'],
            ['Text', 'txt', { email, text: 'Sample text' }, null, '']
        ])('stores a %s submission as <uuid>.%s and records it in the spreadsheet', async (type, ext, body, files, original) => {
            Object.assign(req, { body, files });

            servicesCitationSaver(req, res);
            await flushPromises();

            const path = (mv.mock.calls[0] ?? fs.promises.writeFile.mock.calls[0])[0];
            const name = path.split('/').pop();
            expect(path).toMatch(new RegExp(`^uploads/CitationSaver/${uuid}\\.${ext}$`));
            expect(addToSpreadsheet).toHaveBeenCalledWith(
                [expect.any(String), expect.any(Number), email, type, original, name, path]);
        });

        it.each(['constructor', '__proto__', 'toString'])('rejects an uploaded file with mimetype %s', (mimetype) => {
            Object.assign(req, { body: { email }, files: file('evil', mimetype) });

            servicesCitationSaver(req, res);

            expect(mv).not.toHaveBeenCalled();
            expect(addToSpreadsheet).not.toHaveBeenCalled();
            expect(res.send).toHaveBeenCalledWith({ status: false, message: 'services-citation-saver.errors.file.mimetype' });
        });

        it('rejects a URL whose content-type is constructor', async () => {
            mockFetch.mockResolvedValue({ ok: true, headers: new Map([['content-type', 'constructor'], ['content-length', '5000']]) });
            req.body = { email, url: 'http://example.com' };

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(fs.promises.writeFile).not.toHaveBeenCalled();
            expect(res.send).toHaveBeenCalledWith({ status: false, message: 'services-citation-saver.errors.URL.mimetype' });
        });
    });

    // Regression tests for #176. Jest fails a test on any uncaught exception or unhandled
    // rejection, which is how a crash of the real process shows up here.
    describe('Write failures and ordering (#176)', () => {
        const email = 'test@example.com';
        const failure = { status: false, message: 'services-citation-saver.errors.default' };
        const fsError = (code) => Object.assign(new Error(code + ': simulated'), { code });

        const deferred = () => {
            let resolve;
            const promise = new Promise(r => { resolve = r; });
            return { promise, resolve };
        };

        const submissions = {
            text: () => ({ body: { text: 'hello', email }, files: null }),
            url: () => ({ body: { url: 'http://example.com', email }, files: null }),
            file: (mv) => ({ body: { email }, files: { file: { name: 'doc.pdf', mimetype: 'application/pdf', size: 5000, mv } } })
        };

        it.each(['text', 'url'])('returns status:false and keeps running when writing a %s submission fails', async (kind) => {
            fs.promises.writeFile.mockRejectedValue(fsError('ENOSPC'));
            Object.assign(req, submissions[kind]());

            await expect(servicesCitationSaver(req, res)).resolves.toBeUndefined();

            expect(res.send).toHaveBeenCalledTimes(1);
            expect(res.send).toHaveBeenCalledWith(failure);
            expect(addToSpreadsheet).not.toHaveBeenCalled();
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringMatching(
                /Something unexpected occurred\. Reason: .*"code":"ENOSPC".*"message":"ENOSPC: simulated"/));
            const writtenPath = fs.promises.writeFile.mock.calls[0][0];
            expect(fs.promises.rm).toHaveBeenCalledWith(writtenPath, { force: true });
        });

        it('returns status:false and keeps running when moving an uploaded file fails', async () => {
            const mv = jest.fn().mockRejectedValue(fsError('EACCES'));
            Object.assign(req, submissions.file(mv));

            await expect(servicesCitationSaver(req, res)).resolves.toBeUndefined();

            expect(res.send).toHaveBeenCalledTimes(1);
            expect(res.send).toHaveBeenCalledWith(failure);
            expect(addToSpreadsheet).not.toHaveBeenCalled();
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Something unexpected occurred.'));
            expect(fs.promises.rm).toHaveBeenCalledWith(mv.mock.calls[0][0], { force: true });
        });

        it('still reports the original failure when cleanup also fails', async () => {
            fs.promises.writeFile.mockRejectedValue(fsError('ENOSPC'));
            fs.promises.rm.mockRejectedValue(fsError('EPERM'));
            Object.assign(req, submissions.text());

            await expect(servicesCitationSaver(req, res)).resolves.toBeUndefined();

            expect(res.send).toHaveBeenCalledTimes(1);
            expect(res.send).toHaveBeenCalledWith(failure);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('ENOSPC'));
        });

        it.each(['text', 'url', 'file'])('adds the Sheet row and replies only after a %s submission is on disk', async (kind) => {
            const onDisk = deferred();
            const mv = jest.fn(() => onDisk.promise);
            fs.promises.writeFile.mockImplementation(() => onDisk.promise);
            Object.assign(req, submissions[kind](mv));

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(addToSpreadsheet).not.toHaveBeenCalled();
            expect(res.send).not.toHaveBeenCalled();

            onDisk.resolve();
            await flushPromises();

            expect(addToSpreadsheet).toHaveBeenCalledTimes(1);
            expect(res.send).toHaveBeenCalledTimes(1);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ status: true }));
        });
    });
});
