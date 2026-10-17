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
const path = require('path');
const config = require('config');
const { REQUEST_TIMEOUT_MS, messages, makeUploadFolders, filesUnder, post: postTo, translationsLoaded, loadApp } =
    require('./helpers/citationsaver-app.cjs');

// The temporary folder is the default one: next to the upload folder, not inside it.
const { root: tmpRoot, uploadFolder, uploadTempFolder } = makeUploadFolders('citationsaver-177-');
// Larger than one read chunk (64 KiB), so a text file can span several chunks.
const MAX_UPLOAD_SIZE = 256 * 1024;
config.set('citation.saver.upload.folder.path', uploadFolder);
config.set('citation.saver.max.upload.size', MAX_UPLOAD_SIZE);

const http = require('http');
const fetch = require('node-fetch');
const dns = require('node:dns');
const addToSpreadsheet = require('../spreadsheet-client');
const app = require('../../app');

const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');

const post = () => postTo(app);

function storedFiles() {
    return fs.existsSync(uploadFolder) ? fs.readdirSync(uploadFolder) : [];
}

function storedContent(name) {
    return fs.readFileSync(path.join(uploadFolder, name));
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
    beforeAll(() => translationsLoaded(app));

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

        it('stores an empty uploaded text file, as before #177', async () => {
            const res = await post().attach('file', Buffer.alloc(0), { filename: 'empty.txt', contentType: 'text/plain' });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                status: true,
                message: 'File uploaded',
                data: { name: 'empty.txt', mimetype: 'text/plain', size: 0 }
            });
            const stored = storedFiles();
            expect(stored).toHaveLength(1);
            expect(storedContent(stored[0])).toHaveLength(0);
        });

        it('stores a text sent as a file part, as the page sends it', async () => {
            const res = await post()
                .attach('text', Buffer.from('Citações: https://arquivo.pt\n'), { filename: 'text.txt', contentType: 'text/plain' })
                .field('email', 'a@b.pt');

            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                status: true,
                message: 'Text uploaded',
                data: { name: '', mimetype: 'text/plain', size: Buffer.byteLength('Citações: https://arquivo.pt\n') }
            });
            const stored = storedFiles();
            expect(stored).toHaveLength(1);
            expect(stored[0]).toMatch(/^[0-9a-f-]{36}\.txt$/);
            expect(storedContent(stored[0]).toString('utf8')).toBe('Citações: https://arquivo.pt\n');
            expect(addToSpreadsheet).toHaveBeenCalledWith([
                expect.any(String), expect.any(Number), 'a@b.pt', 'Text', '', stored[0], expect.stringContaining(stored[0])
            ]);
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
            expect(fetch).toHaveBeenCalledWith('https://example.com/paper.pdf', expect.objectContaining({ method: 'HEAD', redirect: 'error' }));
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

        it.each([
            ['an unexpected end of the body', '--b177\r\nContent-Disposition: form-data; name="text"\r\n\r\nabc'],
            ['a malformed part header', '--b177\r\nContent-Disposition: form-data; name="text"\r\n'
                + 'x'.repeat(100 * 1024) + '\r\n\r\nabc\r\n--b177--\r\n'],
        ])('replies 400 JSON and keeps serving for a multipart body with %s', async (_case, body) => {
            const res = await post().set('Content-Type', 'multipart/form-data; boundary=b177').send(body);

            expect(res.status).toBe(400);
            expect(res.headers['content-type']).toMatch(/^application\/json/);
            expect(res.body).toEqual({ status: false, message: messages.default });
            expect(storedFiles()).toHaveLength(0);
            const next = await post().field('text', 'still here');
            expect(next.body).toEqual(expect.objectContaining({ status: true }));
        });

        it.each([
            // As a page sent it before the empty text was left out.
            ['an empty text file part', (req) => req.attach('text', Buffer.alloc(0), { filename: 'text.txt', contentType: 'text/plain' }).field('email', 'a@b.pt')],
            ['an empty multipart text field', (req) => req.field('text', '')],
            ['an empty urlencoded text field', (req) => req.type('form').send({ text: '', email: 'a@b.pt' })],
        ])('replies "no document" for %s and stores nothing', async (_case, send) => {
            const res = await send(post());

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ status: false, message: messages.empty });
            expect(storedFiles()).toHaveLength(0);
            expect(addToSpreadsheet).not.toHaveBeenCalled();
        });

        it('replies status:false for a text file part with a NUL byte', async () => {
            const res = await post().attach('text', Buffer.from('a\u0000b'), { filename: 'text.txt', contentType: 'text/plain' });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ status: false, message: messages.default });
            expect(storedFiles()).toHaveLength(0);
            expect(addToSpreadsheet).not.toHaveBeenCalled();
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

    describe('email and URL length limits (#177)', () => {
        // Nothing may log or store the value before it is checked.
        function expectNotLoggedOrStored(value) {
            const logged = Object.values(mockLogger).flatMap(log => log.mock.calls.flat()).join('\n');
            expect(logged).not.toContain(value.slice(0, 300));
            expect(addToSpreadsheet).not.toHaveBeenCalled();
            expect(fetch).not.toHaveBeenCalled();
            expect(storedFiles()).toHaveLength(0);
        }

        const longEmail = 'a'.repeat(250) + '@b.pt';
        const longUrl = 'https://example.com/' + 'a'.repeat(8192) + '.pdf';

        it.each([
            ['multipart', (req, fields) => Object.entries(fields).reduce((r, [k, v]) => r.field(k, v), req)],
            ['urlencoded', (req, fields) => req.type('form').send(fields)],
        ])('replies 400 JSON for an email over 254 characters (%s)', async (_kind, send) => {
            const res = await send(post(), { text: 'some citations', email: longEmail });

            expect(res.status).toBe(400);
            expect(res.body).toEqual({ status: false, message: messages.emailInvalid });
            expectNotLoggedOrStored(longEmail);
        });

        it.each([
            ['multipart', (req, fields) => Object.entries(fields).reduce((r, [k, v]) => r.field(k, v), req)],
            ['urlencoded', (req, fields) => req.type('form').send(fields)],
        ])('replies 400 JSON for a URL over 8192 characters (%s)', async (_kind, send) => {
            const res = await send(post(), { url: longUrl, email: 'a@b.pt' });

            expect(res.status).toBe(400);
            expect(res.body).toEqual({ status: false, message: messages.urlInvalid });
            expectNotLoggedOrStored(longUrl);
        });

        it('replies 400 JSON for an email far over the field size, cut short by the parser', async () => {
            const hugeEmail = 'e'.repeat(MAX_UPLOAD_SIZE) + '@b.pt';

            const res = await post()
                .attach('file', PDF, { filename: 'paper.pdf', contentType: 'application/pdf' })
                .field('email', hugeEmail);

            expect(res.status).toBe(400);
            expect(res.body).toEqual({ status: false, message: messages.emailInvalid });
            expectNotLoggedOrStored(hugeEmail);
        });

        it('replies 400 JSON for an email sent twice', async () => {
            const res = await post().field('text', 'some citations').field('email', 'a@b.pt').field('email', 'c@d.pt');

            expect(res.status).toBe(400);
            expect(res.body).toEqual({ status: false, message: messages.emailInvalid });
            expect(storedFiles()).toHaveLength(0);
        });

        it('accepts an email of 254 characters and a URL of 8192 characters', async () => {
            const email = 'a'.repeat(249) + '@b.pt';
            const url = 'https://example.com/' + 'a'.repeat(8192 - 24) + '.pdf';
            expect([email.length, url.length]).toEqual([254, 8192]);

            const res = await post().field('url', url).field('email', email);

            expect(res.body).toEqual(expect.objectContaining({ status: true, message: 'Link uploaded' }));
            expect(addToSpreadsheet).toHaveBeenCalledWith(expect.arrayContaining([email, url]));
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
            expect(JSON.parse(reply.body)).toEqual({ status: false, message: messages.uploadFilesize });
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

        it('rejects a multipart body over the limit with 413 even when no single part is', async () => {
            // Just over the limit, so the client is done writing by the time of the reply.
            let req = post();
            for (let i = 0; i < 5; i++) {
                req = req.field('field' + i, 'x'.repeat(MAX_UPLOAD_SIZE));
            }

            const res = await req;

            expect(res.status).toBe(413);
            expect(res.body).toEqual({ status: false, message: messages.uploadFilesize });
            expect(storedFiles()).toHaveLength(0);
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

        it('logs a warning and keeps serving when the temporary folder cannot be removed', async () => {
            const rm = jest.spyOn(fs.promises, 'rm').mockRejectedValueOnce(new Error('EBUSY'));
            try {
                const res = await post().field('text', 'some citations');

                expect(res.body).toEqual(expect.objectContaining({ status: true }));
                for (let i = 0; i < 50 && mockLogger.warn.mock.calls.length === 0; i++) {
                    await new Promise(resolve => setTimeout(resolve, 20));
                }
                expect(mockLogger.warn).toHaveBeenCalledWith(
                    expect.stringMatching(/^Could not remove temporary upload folder .*: Error: EBUSY$/));
            } finally {
                rm.mockRestore();
                // The folder the failed call left behind.
                fs.rmSync(uploadTempFolder, { recursive: true, force: true });
            }
            const next = await post().field('text', 'still here');
            expect(next.body).toEqual(expect.objectContaining({ status: true }));
        });

        it('replies 500 JSON and keeps serving when the temporary file cannot be written', async () => {
            const { Writable } = require('node:stream');
            const createWriteStream = jest.spyOn(fs, 'createWriteStream').mockImplementationOnce(() => new Writable({
                write(chunk, encoding, callback) {
                    callback(Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC', syscall: 'write' }));
                }
            }));
            try {
                const res = await post().attach('file', PDF, { filename: 'paper.pdf', contentType: 'application/pdf' });

                expect(res.status).toBe(500);
                expect(res.body).toEqual({ status: false, message: messages.default });
                expect(storedFiles()).toHaveLength(0);
                expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('ENOSPC'));
            } finally {
                createWriteStream.mockRestore();
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
            for (let i = 0; i < 50 && filesUnder(uploadTempFolder).length === 0; i++) {
                await new Promise(resolve => setTimeout(resolve, 20));
            }
            expect(filesUnder(uploadTempFolder)).toHaveLength(1);
            req.destroy();
            await received;

            await expectNoTempFiles();
            expect(storedFiles()).toHaveLength(0);
        });
    });

    describe('texts (#177)', () => {
        // Over busboy's default field size (1 MiB), which used to cut a text off silently.
        const TEXT_LIMIT = 2 * 1024 * 1024;
        let textApp;

        beforeAll(async () => {
            ({ app: textApp } = loadApp(uploadFolder, { 'citation.saver.max.upload.size': TEXT_LIMIT }));
            await translationsLoaded(textApp);
        });

        const attachText = (req, text) => req.attach('text', Buffer.from(text), { filename: 'text.txt', contentType: 'text/plain' });

        it('stores a text file part of exactly the limit in full', async () => {
            const text = 'x'.repeat(TEXT_LIMIT);

            const res = await attachText(postTo(textApp), text);

            expect(res.body).toEqual(expect.objectContaining({ status: true, message: 'Text uploaded' }));
            expect(storedContent(storedFiles()[0]).toString('utf8')).toBe(text);
        });

        it('rejects a text file part over the limit with 413 and the file or text size message', async () => {
            const res = await attachText(postTo(textApp), 'x'.repeat(TEXT_LIMIT + 1));

            expect(res.status).toBe(413);
            expect(res.body).toEqual({ status: false, message: messages.uploadFilesize });
            expect(storedFiles()).toHaveLength(0);
        });

        it('rejects a text field over the limit with the text size message', async () => {
            // An urlencoded body is not parsed by parseUpload; its size limit is express's.
            const { app: smallApp } = loadApp(uploadFolder, { 'citation.saver.max.upload.size': 10 });
            await translationsLoaded(smallApp);

            const res = await postTo(smallApp).type('form').send({ text: 'x'.repeat(11) });

            expect(res.status).toBe(413);
            expect(res.body).toEqual({ status: false, message: messages.textFilesize });
            expect(storedFiles()).toHaveLength(0);
        });

        it.each([
            ['just over 100 KiB', 100 * 1024 + 1],
            ['that the parser cut short', 200 * 1024],
        ])('rejects a multipart text field %s with 413 and the text size message, storing nothing', async (_case, length) => {
            const res = await postTo(textApp).field('text', 'x'.repeat(length));

            expect(res.status).toBe(413);
            expect(res.headers['content-type']).toMatch(/^application\/json/);
            expect(res.body).toEqual({ status: false, message: messages.textFilesize });
            expect(storedFiles()).toHaveLength(0);
            expect(addToSpreadsheet).not.toHaveBeenCalled();
        });

        it('stores a multipart text field of 100 KiB in full', async () => {
            const text = 'x'.repeat(100 * 1024);

            const res = await postTo(textApp).field('text', text);

            expect(res.body).toEqual(expect.objectContaining({ status: true, message: 'Text uploaded' }));
            expect(storedContent(storedFiles()[0]).toString('utf8')).toBe(text);
        });
    });

    describe('temporary folder setting (#177)', () => {
        it.each([
            ['the upload folder', (folder) => folder],
            ['a folder inside it', (folder) => path.join(folder, 'tmp')],
        ])('refuses to start with the temporary folder set to %s', (_case, tempFolder) => {
            expect(() => loadApp(uploadFolder, { 'citation.saver.upload.temp.folder.path': tempFolder(uploadFolder) }))
                .toThrow('"citation.saver.upload.temp.folder.path" must not be inside "citation.saver.upload.folder.path"');
        });

        it('refuses a folder inside it whose name starts with ".."', () => {
            expect(() => loadApp(uploadFolder, { 'citation.saver.upload.temp.folder.path': path.join(uploadFolder, '..tmp') }))
                .toThrow('must not be inside');
        });

        it('accepts a folder next to the upload folder', () => {
            expect(() => loadApp(uploadFolder, { 'citation.saver.upload.temp.folder.path': path.join(uploadFolder, '..', 'tmp') }))
                .not.toThrow();
        });
    });

    describe('content sniffing (#177)', () => {
        // The other cases are in services-citationsaver.test.js; this one needs a real
        // temporary file read in several chunks.
        it('rejects a long text file with a NUL byte after the first chunk', async () => {
            const content = Buffer.concat([Buffer.alloc(100 * 1024, 'a'), Buffer.from([0x00]), Buffer.from('b')]);

            const res = await post().attach('file', content, { filename: 'long.txt', contentType: 'text/plain' });

            expect(res.body).toEqual({ status: false, message: messages.mimetype });
            expect(storedFiles()).toHaveLength(0);
        });
    });
});
