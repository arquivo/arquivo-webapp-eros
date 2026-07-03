'use strict';

jest.mock('config');
jest.mock('node-fetch');
jest.mock('fs');
jest.mock('google-spreadsheet');
jest.mock('../utils/is-valid-url');

const servicesCitationSaver = require('../services-citationsaver');
const fetch = require('node-fetch');
const fs = require('fs');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const isValidUrl = require('../utils/is-valid-url');

const flushPromises = () => new Promise(resolve => setImmediate(resolve));

describe('Citation Saver Service', () => {
    let req, res;
    let mockFetch;
    let mockGoogleSheet;

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

        // Mock GoogleSpreadsheet
        mockGoogleSheet = {
            useServiceAccountAuth: jest.fn().mockResolvedValue(),
            loadInfo: jest.fn().mockResolvedValue(),
            sheetsByIndex: [{
                addRow: jest.fn().mockResolvedValue()
            }]
        };
        GoogleSpreadsheet.mockImplementation(() => mockGoogleSheet);

        // Mock fs
        fs.writeFile.mockImplementation((path, data, cb) => cb(null));
        fs.unlink.mockImplementation((path, cb) => cb && cb(null));

        isValidUrl.mockReturnValue(true);
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

    describe('Spreadsheet logging', () => {
        it('attempts to log file upload to spreadsheet', () => {
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

            // Spreadsheet logging happens asynchronously
            expect(GoogleSpreadsheet).toHaveBeenCalled();
        });

        it('logs URL submission to spreadsheet', async () => {
            req.body = { url: 'http://example.com', email: 'test@example.com' };

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(GoogleSpreadsheet).toHaveBeenCalled();
        });
    });
});
