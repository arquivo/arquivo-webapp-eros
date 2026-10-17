'use strict';

// POST /services/citationsaver through the real app (#177): multipart parsing, the
// stored files and the JSON replies that public/js/citation-saver.js reads
// ({ status, message }). The Google Sheet client, DNS and the URL HEAD request are
// mocked, so nothing leaves the machine. Uploads go to a temporary folder.

jest.mock('../../src/apis/page-search-api');
jest.mock('../../src/apis/image-search-api');
jest.mock('../../src/apis/cdx-api');
jest.mock('../../src/apis/suggestion-api');
jest.mock('../spreadsheet-client');
jest.mock('node-fetch');
jest.mock('node:dns');

const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
jest.mock('../logger', () => () => mockLogger);
// After a client goes away mid-upload, express-fileupload drops the file only once its
// idle timer fires. Unref the timer so it does not keep Jest running after the tests.
jest.mock('express-fileupload/lib/uploadtimer', () => {
    const UploadTimer = jest.requireActual('express-fileupload/lib/uploadtimer');
    return class extends UploadTimer {
        set() {
            const started = super.set();
            this.timer?.unref();
            return started;
        }
    };
});

const fs = require('fs');
const os = require('os');
const path = require('path');
const config = require('config');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'citationsaver-177-'));
const uploadFolder = path.join(tmpRoot, 'uploads', 'CitationSaver');
// The default temporary folder: next to the upload folder, not inside it.
const uploadTempFolder = path.join(tmpRoot, 'uploads', '.citationsaver-tmp');
// Larger than one read chunk (64 KiB), so a text file can span several chunks.
const MAX_UPLOAD_SIZE = 256 * 1024;
config.set('citation.saver.upload.folder.path', uploadFolder);
config.set('citation.saver.max.upload.size', MAX_UPLOAD_SIZE);
// Every test posts from the same IP; the rate limit has its own suite.
config.set('citation.saver.rate.limit.max', 1000);

const http = require('http');
const request = require('supertest');
const fetch = require('node-fetch');
const dns = require('node:dns');
const addToSpreadsheet = require('../spreadsheet-client');
const app = require('../../app');

// Fail fast instead of hanging Jest if a request never gets a response
const REQUEST_TIMEOUT_MS = 5000;

const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');

const messages = {
    empty: 'Nenhum documento foi submetido.',
    missing: 'O ficheiro não foi transferido, nenhum ficheiro foi submetido.',
    mimetype: 'O ficheiro não foi transferido. O formato do documento tem de ser PDF ou TXT.',
    filesize: 'O ficheiro não foi transferido. A dimensão do documento não pode exceder os 100 MB.',
    default: 'Algo correu mal, por favor tente novamente mais tarde.',
};

function post() {
    return request(app).post('/services/citationsaver').timeout(REQUEST_TIMEOUT_MS);
}

function storedFiles() {
    return fs.existsSync(uploadFolder) ? fs.readdirSync(uploadFolder) : [];
}

function storedContent(name) {
    return fs.readFileSync(path.join(uploadFolder, name));
}

// Every file left under the temporary upload folder, at any depth.
function tempFiles() {
    if (!fs.existsSync(uploadTempFolder)) return [];
    return fs.readdirSync(uploadTempFolder, { recursive: true })
        .filter(name => fs.statSync(path.join(uploadTempFolder, name)).isFile());
}

// The temporary folder of a request is removed once its response is closed, which
// can happen just after the client got the reply.
async function expectNoTempFiles() {
    const tempEntries = () => fs.existsSync(uploadTempFolder) ? fs.readdirSync(uploadTempFolder) : [];
    for (let i = 0; i < 50 && tempEntries().length > 0; i++) {
        await new Promise(resolve => setTimeout(resolve, 20));
    }
    expect(tempEntries()).toEqual([]);
}

/*
 * Streams a multipart file of `size` bytes to `port` without ever ending the request,
 * so a reply proves the upload was rejected while streaming, before the whole body
 * arrived. Resolves with the reply, or 'no reply' after REQUEST_TIMEOUT_MS.
 */
function streamUploadWithoutEnding(port, size) {
    return new Promise((resolve) => {
        const boundary = 'citationsaver177boundary';
        const req = http.request({
            port,
            method: 'POST',
            path: '/services/citationsaver',
            headers: { 'content-type': 'multipart/form-data; boundary=' + boundary },
        });
        const timer = setTimeout(() => {
            req.destroy();
            resolve('no reply');
        }, REQUEST_TIMEOUT_MS);
        // The server may close the connection while this side is still writing.
        req.on('error', () => {});
        req.on('response', (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                clearTimeout(timer);
                req.destroy();
                resolve({ status: res.statusCode, contentType: res.headers['content-type'], body });
            });
        });
        req.write('--' + boundary + '\r\n'
            + 'Content-Disposition: form-data; name="file"; filename="big.pdf"\r\n'
            + 'Content-Type: application/pdf\r\n\r\n');
        const chunk = Buffer.alloc(8 * 1024, 'a');
        let sent = 0;
        (function writeMore() {
            while (sent < size && !req.destroyed) {
                sent += chunk.length;
                if (!req.write(chunk)) {
                    req.once('drain', writeMore);
                    return;
                }
            }
        })();
    });
}

describe('POST /services/citationsaver through the app', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        fs.rmSync(uploadFolder, { recursive: true, force: true });
        addToSpreadsheet.mockResolvedValue();
        dns.lookup.mockImplementation((hostname, opts, cb) => cb(null, [{ address: '93.184.216.34', family: 4 }]));
        fetch.mockResolvedValue({
            ok: true,
            headers: new Map([['content-type', 'application/pdf'], ['content-length', '5000']])
        });
    });

    afterAll(() => {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    afterEach(async () => {
        await expectNoTempFiles();
    });

    describe('characterization: submissions that are accepted', () => {
        it('stores an uploaded PDF and replies with its name, mimetype and size', async () => {
            const res = await post()
                .field('email', 'a@b.pt')
                .attach('file', PDF, { filename: 'paper.pdf', contentType: 'application/pdf' });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                status: true,
                message: 'File uploaded',
                data: { name: 'paper.pdf', mimetype: 'application/pdf', size: PDF.length }
            });
            const stored = storedFiles();
            expect(stored).toHaveLength(1);
            expect(stored[0]).toMatch(/^[0-9a-f-]{36}\.pdf$/);
            expect(storedContent(stored[0])).toEqual(PDF);
            expect(addToSpreadsheet).toHaveBeenCalledWith([
                expect.any(String), expect.any(Number), 'a@b.pt', 'File', 'paper.pdf', stored[0], expect.stringContaining(stored[0])
            ]);
        });

        it.each([
            ['text/plain', 'notes.txt', 'txt', 'Citações: https://arquivo.pt\n'],
            ['text/html', 'page.html', 'html', '<!doctype html><p>Olá <a href="https://arquivo.pt">arquivo</a></p>'],
        ])('stores an uploaded %s file', async (mimetype, filename, extension, content) => {
            const res = await post()
                .attach('file', Buffer.from(content, 'utf8'), { filename, contentType: mimetype });

            expect(res.status).toBe(200);
            expect(res.body).toEqual(expect.objectContaining({ status: true, message: 'File uploaded' }));
            const stored = storedFiles();
            expect(stored).toHaveLength(1);
            expect(stored[0].endsWith('.' + extension)).toBe(true);
            expect(storedContent(stored[0]).toString('utf8')).toBe(content);
        });

        it('stores a text sent as a multipart field', async () => {
            const res = await post().field('text', 'some citations').field('email', '');

            expect(res.status).toBe(200);
            expect(res.body).toEqual(expect.objectContaining({ status: true, message: 'Text uploaded' }));
            const stored = storedFiles();
            expect(stored).toHaveLength(1);
            expect(storedContent(stored[0]).toString('utf8')).toBe('some citations');
        });

        it.each([
            ['multipart', (req) => req.field('url', 'https://example.com/paper.pdf').field('email', 'a@b.pt')],
            ['urlencoded', (req) => req.type('form').send({ url: 'https://example.com/paper.pdf', email: 'a@b.pt' })],
        ])('stores a URL sent as a %s form', async (kind, send) => {
            const res = await send(post());

            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                status: true,
                message: 'Link uploaded',
                data: { name: 'https://example.com/paper.pdf', mimetype: '', size: 'https://example.com/paper.pdf'.length }
            });
            expect(fetch).toHaveBeenCalledWith('https://example.com/paper.pdf', { method: 'HEAD', redirect: 'error' });
            const stored = storedFiles();
            expect(stored).toHaveLength(1);
            expect(stored[0]).toMatch(/\.link$/);
            expect(storedContent(stored[0]).toString('utf8')).toBe('https://example.com/paper.pdf');
        });
    });

    describe('characterization: submissions that are rejected', () => {
        it('replies status:false for an empty multipart form', async () => {
            const res = await post().field('email', 'a@b.pt');

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ status: false, message: messages.empty });
            expect(storedFiles()).toHaveLength(0);
        });

        it('replies 400 JSON and keeps serving for a multipart Content-Type without a boundary', async () => {
            const res = await post().set('Content-Type', 'multipart/form-data; charset=utf-8').send('--x\r\n\r\n');

            expect(res.status).toBe(400);
            expect(res.headers['content-type']).toMatch(/^application\/json/);
            expect(res.body).toEqual({ status: false, message: messages.default });
            expect(storedFiles()).toHaveLength(0);
            // The process is still up and serving.
            const next = await post().field('text', 'still here');
            expect(next.body).toEqual(expect.objectContaining({ status: true }));
        });

        it('replies status:false for a file with an unsupported mimetype', async () => {
            const res = await post()
                .attach('file', Buffer.from('PK\u0003\u0004'), { filename: 'doc.docx', contentType: 'application/zip' });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ status: false, message: messages.mimetype });
            expect(storedFiles()).toHaveLength(0);
            expect(addToSpreadsheet).not.toHaveBeenCalled();
        });
    });

    describe('multipart parsing limits (#177)', () => {
        let server;
        let port;

        beforeAll((done) => {
            server = app.listen(0, () => {
                port = server.address().port;
                done();
            });
        });

        afterAll((done) => {
            server.close(done);
        });

        it('rejects an upload over the limit with 413 while it is still streaming', async () => {
            const reply = await streamUploadWithoutEnding(port, 4 * MAX_UPLOAD_SIZE);

            expect(reply).not.toBe('no reply');
            expect(reply.status).toBe(413);
            expect(reply.contentType).toMatch(/^application\/json/);
            expect(JSON.parse(reply.body)).toEqual({ status: false, message: messages.filesize });
            expect(storedFiles()).toHaveLength(0);
            expect(addToSpreadsheet).not.toHaveBeenCalled();
        });

        it('accepts a file of exactly the limit', async () => {
            const content = Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(MAX_UPLOAD_SIZE - 5, 'a')]);

            const res = await post().attach('file', content, { filename: 'max.pdf', contentType: 'application/pdf' });

            expect(res.status).toBe(200);
            expect(res.body).toEqual(expect.objectContaining({ status: true }));
            expect(storedFiles()).toHaveLength(1);
        });

        it('keeps only the first file when several are sent', async () => {
            const res = await post()
                .attach('file', PDF, { filename: 'first.pdf', contentType: 'application/pdf' })
                .attach('file', PDF, { filename: 'second.pdf', contentType: 'application/pdf' });

            expect(res.status).toBe(200);
            expect(res.body.data).toEqual(expect.objectContaining({ name: 'first.pdf' }));
            expect(storedFiles()).toHaveLength(1);
        });

        it('replies "file missing" for a file sent under another field name', async () => {
            const res = await post().attach('document', PDF, { filename: 'paper.pdf', contentType: 'application/pdf' });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ status: false, message: messages.missing });
            expect(storedFiles()).toHaveLength(0);
        });

        it('removes the temporary file when storing the upload fails', async () => {
            // A regular file where the upload folder should be: storing fails.
            fs.writeFileSync(uploadFolder, 'not a directory');

            const res = await post().attach('file', PDF, { filename: 'paper.pdf', contentType: 'application/pdf' });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ status: false, message: messages.default });
            expect(addToSpreadsheet).not.toHaveBeenCalled();
            fs.rmSync(uploadFolder);
        });

        it('replies 500 JSON and keeps serving when the temporary folder cannot be created', async () => {
            fs.rmSync(uploadTempFolder, { recursive: true, force: true });
            fs.mkdirSync(path.dirname(uploadTempFolder), { recursive: true });
            fs.writeFileSync(uploadTempFolder, 'not a directory');
            try {
                const res = await post().attach('file', PDF, { filename: 'paper.pdf', contentType: 'application/pdf' });

                expect(res.status).toBe(500);
                expect(res.body).toEqual({ status: false, message: messages.default });
                expect(storedFiles()).toHaveLength(0);
                expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(uploadTempFolder));
            } finally {
                fs.rmSync(uploadTempFolder);
            }
            const next = await post().field('text', 'still here');
            expect(next.body).toEqual(expect.objectContaining({ status: true }));
        });

        it('removes the temporary file when the client goes away mid-upload', async () => {
            const received = new Promise(resolve => server.once('request', (req, res) => res.once('close', resolve)));
            const req = http.request({
                port,
                method: 'POST',
                path: '/services/citationsaver',
                headers: { 'content-type': 'multipart/form-data; boundary=b177' },
            });
            req.on('error', () => {});
            req.write('--b177\r\nContent-Disposition: form-data; name="file"; filename="a.pdf"\r\n'
                + 'Content-Type: application/pdf\r\n\r\n%PDF-' + 'a'.repeat(1024));
            // Wait for the partial file to reach the disk, then drop the connection.
            for (let i = 0; i < 50 && tempFiles().length === 0; i++) {
                await new Promise(resolve => setTimeout(resolve, 20));
            }
            expect(tempFiles()).toHaveLength(1);
            req.destroy();
            await received;

            await expectNoTempFiles();
            expect(storedFiles()).toHaveLength(0);
        });
    });

    describe('content sniffing (#177)', () => {
        it.each([
            ['HTML', Buffer.from('<!doctype html><script>alert(1)</script>')],
            ['a PNG image', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])],
        ])('rejects %s sent as application/pdf', async (label, content) => {
            const res = await post()
                .attach('file', content, { filename: 'paper.pdf', contentType: 'application/pdf' });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ status: false, message: messages.mimetype });
            expect(storedFiles()).toHaveLength(0);
            expect(addToSpreadsheet).not.toHaveBeenCalled();
        });

        it.each([
            ['text/plain', 'notes.txt', 'binary bytes', Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe])],
            ['text/html', 'page.html', 'invalid UTF-8', Buffer.from('<p>caf\xe9</p>', 'latin1')],
        ])('rejects a %s file (%s) with %s', async (mimetype, filename, label, content) => {
            const res = await post().attach('file', content, { filename, contentType: mimetype });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ status: false, message: messages.mimetype });
            expect(storedFiles()).toHaveLength(0);
        });

        it('accepts a UTF-8 text file whose characters span read chunks', async () => {
            // An odd offset puts a 2-byte character across each 64 KiB chunk boundary.
            const content = Buffer.from('a' + 'é'.repeat(100 * 1024), 'utf8');

            const res = await post().attach('file', content, { filename: 'long.txt', contentType: 'text/plain' });

            expect(res.status).toBe(200);
            expect(res.body).toEqual(expect.objectContaining({ status: true }));
            const stored = storedFiles();
            expect(stored).toHaveLength(1);
            // Buffer#equals: Jest's toEqual compares a large Buffer byte by byte, slowly.
            expect(storedContent(stored[0]).equals(content)).toBe(true);
        });

        it('rejects a long text file with a NUL byte after the first chunk', async () => {
            const content = Buffer.concat([Buffer.alloc(100 * 1024, 'a'), Buffer.from([0x00]), Buffer.from('b')]);

            const res = await post().attach('file', content, { filename: 'long.txt', contentType: 'text/plain' });

            expect(res.body).toEqual({ status: false, message: messages.mimetype });
            expect(storedFiles()).toHaveLength(0);
        });
    });
});
