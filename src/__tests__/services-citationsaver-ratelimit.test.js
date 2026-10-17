'use strict';

// POST /services/citationsaver is rate-limited per client IP (#177). Over the limit
// the reply is a 429 with the { status, message } JSON that
// public/js/citation-saver.js reads, and the submission is neither parsed nor stored.

jest.mock('../../src/apis/page-search-api');
jest.mock('../../src/apis/image-search-api');
jest.mock('../../src/apis/cdx-api');
jest.mock('../../src/apis/suggestion-api');
jest.mock('../spreadsheet-client');

const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
jest.mock('../logger', () => () => mockLogger);

const fs = require('fs');
const os = require('os');
const path = require('path');
const config = require('config');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'citationsaver-177-rl-'));
const uploadFolder = path.join(tmpRoot, 'uploads');
const uploadTempFolder = path.join(tmpRoot, 'tmp');
const LIMIT = 3;
config.set('citation.saver.upload.folder.path', uploadFolder);
config.set('citation.saver.upload.temp.folder.path', uploadTempFolder);
config.set('citation.saver.rate.limit.max', LIMIT);
config.set('citation.saver.rate.limit.window.ms', 60000);

const request = require('supertest');
const addToSpreadsheet = require('../spreadsheet-client');
const app = require('../../app');

const REQUEST_TIMEOUT_MS = 5000;

const tooMany = { status: false, message: 'Algo correu mal, por favor tente novamente mais tarde.' };

function post() {
    return request(app).post('/services/citationsaver').timeout(REQUEST_TIMEOUT_MS);
}

function filesUnder(folder) {
    if (!fs.existsSync(folder)) return [];
    return fs.readdirSync(folder, { recursive: true })
        .filter(name => fs.statSync(path.join(folder, name)).isFile());
}

describe('POST /services/citationsaver rate limit', () => {
    let consoleError;

    beforeAll(async () => {
        addToSpreadsheet.mockResolvedValue();
        // express-rate-limit reports an X-Forwarded-For header while "trust proxy" is off.
        consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

        for (let i = 0; i < LIMIT; i++) {
            const res = await post().type('form').send({ text: 'citation ' + i });
            expect(res.status).toBe(200);
            expect(res.body).toEqual(expect.objectContaining({ status: true }));
        }
        expect(filesUnder(uploadFolder)).toHaveLength(LIMIT);
    });

    afterAll(() => {
        consoleError.mockRestore();
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    it('replies 429 with the status:false JSON once the limit is reached', async () => {
        const res = await post().type('form').send({ text: 'one too many' });

        expect(res.status).toBe(429);
        expect(res.headers['content-type']).toMatch(/^application\/json/);
        expect(res.body).toEqual(tooMany);
        expect(res.headers['retry-after']).toMatch(/^\d+$/);
        expect(filesUnder(uploadFolder)).toHaveLength(LIMIT);
    });

    it('does not parse or store a file upload once the limit is reached', async () => {
        const res = await post()
            .attach('file', Buffer.from('%PDF-1.4\n%%EOF\n'), { filename: 'paper.pdf', contentType: 'application/pdf' });

        expect(res.status).toBe(429);
        expect(res.body).toEqual(tooMany);
        expect(filesUnder(uploadTempFolder)).toEqual([]);
        expect(filesUnder(uploadFolder)).toHaveLength(LIMIT);
    });

    it('cannot be bypassed with a spoofed X-Forwarded-For header', async () => {
        const res = await post().set('X-Forwarded-For', '203.0.113.7').type('form').send({ text: 'spoofed' });

        expect(res.status).toBe(429);
        expect(res.body).toEqual(tooMany);
    });

    it('does not limit the form page', async () => {
        const res = await request(app).get('/services/citationsaver').timeout(REQUEST_TIMEOUT_MS);

        expect(res.status).toBe(200);
    });

    it('does not add Sheet rows for the blocked submissions', () => {
        expect(addToSpreadsheet).toHaveBeenCalledTimes(LIMIT);
    });
});
