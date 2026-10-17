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

const fs = require('fs');
const os = require('os');
const path = require('path');
const config = require('config');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'citationsaver-177-'));
const uploadFolder = path.join(tmpRoot, 'uploads');
config.set('citation.saver.upload.folder.path', uploadFolder);

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
    mimetype: 'O ficheiro não foi transferido. O formato do documento tem de ser PDF ou TXT.',
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

        it('replies status:false for a file with an unsupported mimetype', async () => {
            const res = await post()
                .attach('file', Buffer.from('PK\u0003\u0004'), { filename: 'doc.docx', contentType: 'application/zip' });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ status: false, message: messages.mimetype });
            expect(storedFiles()).toHaveLength(0);
            expect(addToSpreadsheet).not.toHaveBeenCalled();
        });
    });
});
