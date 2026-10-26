'use strict';

// Regression tests for #176 against the real filesystem: the upload folder does not exist
// when the first submission arrives. Jest fails a test on any uncaught exception or
// unhandled rejection, which is how a crash of the real process shows up here.

jest.mock('config');
jest.mock('node-fetch');
jest.mock('node:dns');
jest.mock('../spreadsheet-client');
jest.mock('../utils/is-valid-url');

const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
jest.mock('../logger', () => () => mockLogger);

const fs = require('fs');
const os = require('os');
const path = require('path');
const config = require('config');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'citationsaver-176-'));
// The temporary file express-fileupload would have written for an uploaded file.
const uploadedTempFile = path.join(tmpRoot, 'uploaded.tmp');
fs.writeFileSync(uploadedTempFile, 'file body');
const uploadFolder = path.join(tmpRoot, 'missing', 'CitationSaver');
const originalUploadFolder = config.get('citation.saver.upload.folder.path');
config.set('citation.saver.upload.folder.path', uploadFolder);

const servicesCitationSaver = require('../services-citationsaver');
const fetch = require('node-fetch');
const dns = require('node:dns');
const addToSpreadsheet = require('../spreadsheet-client');
const isValidUrl = require('../utils/is-valid-url');

const failure = { status: false, message: 'services-citation-saver.errors.default' };

// Resolves with the first res.send() payload, or 'no reply' if none arrives in time.
function submit(service, body, files = null) {
    return new Promise((resolve) => {
        const timer = setTimeout(() => resolve('no reply'), 2000);
        const res = {
            send: jest.fn((payload) => {
                clearTimeout(timer);
                resolve({ payload, storedAtReply: storedFiles() });
            })
        };
        service({ body, files, t: (key) => key }, res);
    });
}

function storedFiles() {
    return fs.existsSync(uploadFolder) ? fs.readdirSync(uploadFolder) : [];
}

describe('Citation Saver with a missing upload folder (#176)', () => {
    let storedAtSheet;

    beforeEach(() => {
        jest.clearAllMocks();
        fs.rmSync(path.join(tmpRoot, 'missing'), { recursive: true, force: true });
        storedAtSheet = null;
        addToSpreadsheet.mockImplementation(async (row) => {
            storedAtSheet = fs.existsSync(row[6]) ? fs.readFileSync(row[6], 'utf8') : null;
        });
        isValidUrl.mockReturnValue(true);
        dns.lookup.mockImplementation((hostname, opts, cb) => cb(null, [{ address: '93.184.216.34', family: 4 }]));
        fetch.mockResolvedValue({
            ok: true,
            headers: new Map([['content-type', 'text/html'], ['content-length', '100']])
        });
    });

    afterAll(() => {
        config.set('citation.saver.upload.folder.path', originalUploadFolder);
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    it.each([
        ['text', { text: 'hello' }, null, 'hello', /\.txt$/],
        ['URL', { url: 'http://example.com' }, null, 'http://example.com', /\.link$/],
        ['file', {}, { file: {
            name: 'doc.txt', mimetype: 'text/plain', size: 9, tempFilePath: uploadedTempFile,
            // Like express-fileupload's mv(): returns a Promise when called without a callback.
            mv: (target) => fs.promises.writeFile(target, 'file body')
        } }, 'file body', /\.txt$/]
    ])('stores a %s submission on disk before the Sheet row and the reply', async (kind, body, files, content, extension) => {
        const reply = await submit(servicesCitationSaver, { ...body, email: 'a@b.pt' }, files);

        expect(reply).not.toBe('no reply');
        expect(reply.payload).toEqual(expect.objectContaining({ status: true }));
        expect(reply.storedAtReply).toHaveLength(1);
        expect(reply.storedAtReply[0]).toMatch(extension);
        expect(fs.readFileSync(path.join(uploadFolder, reply.storedAtReply[0]), 'utf8')).toBe(content);
        expect(addToSpreadsheet).toHaveBeenCalledTimes(1);
        expect(storedAtSheet).toBe(content);
    });

    it.each([
        ['text', { text: 'hello' }, null],
        ['URL', { url: 'http://example.com' }, null],
        ['file', {}, { file: { name: 'doc.txt', mimetype: 'text/plain', size: 9, tempFilePath: uploadedTempFile, mv: (target) => fs.promises.writeFile(target, 'x') } }]
    ])('returns status:false and keeps running when the upload folder is unusable (%s)', async (kind, body, files) => {
        // A regular file where a parent directory should be: mkdir and writes fail with ENOTDIR/EEXIST.
        fs.writeFileSync(path.join(tmpRoot, 'missing'), 'not a directory');

        const reply = await submit(servicesCitationSaver, body, files);

        expect(reply).not.toBe('no reply');
        expect(reply.payload).toEqual(failure);
        expect(addToSpreadsheet).not.toHaveBeenCalled();
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Something unexpected occurred.'));
    });
});
