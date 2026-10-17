'use strict';

// POST /services/citationsaver can be rate-limited per client IP (#177). The limit is
// off by default. Over the limit the reply is a 429 with the { status, message } JSON
// that public/js/citation-saver.js reads, and the submission is neither parsed nor
// stored. Each describe loads its own app, since the settings are read at load time.

jest.mock('../../src/apis/page-search-api');
jest.mock('../../src/apis/image-search-api');
jest.mock('../../src/apis/cdx-api');
jest.mock('../../src/apis/suggestion-api');
jest.mock('../spreadsheet-client');

const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
jest.mock('../logger', () => () => mockLogger);

const fs = require('fs');
const request = require('supertest');
const helpers = require('./helpers/citationsaver-app.cjs');
const { REQUEST_TIMEOUT_MS, messages, makeUploadFolders, filesUnder, post, translationsLoaded } = helpers;

const { root, uploadFolder, uploadTempFolder } = makeUploadFolders('citationsaver-177-rl-');
const tooMany = { status: false, message: messages.default };

const loadApp = (settings) => helpers.loadApp(uploadFolder, settings);

beforeEach(() => {
    fs.rmSync(uploadFolder, { recursive: true, force: true });
});

afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('POST /services/citationsaver with the default settings', () => {
    it('is not rate-limited', async () => {
        const { app } = loadApp({});
        for (let i = 0; i < 15; i++) {
            const res = await post(app).type('form').send({ text: 'citation ' + i });
            expect(res.status).toBe(200);
            expect(res.headers).not.toHaveProperty('ratelimit');
        }
        expect(filesUnder(uploadFolder)).toHaveLength(15);
    });

    it.each(['ten', '-1'])('refuses to start with a rate limit of %p', (max) => {
        expect(() => loadApp({ 'citation.saver.rate.limit.max': max }))
            .toThrow('"citation.saver.rate.limit.max" must be a non-negative number');
    });
});

describe('POST /services/citationsaver rate limit', () => {
    const LIMIT = 3;
    let app;
    let addToSpreadsheet;
    let consoleError;

    beforeAll(async () => {
        ({ app, addToSpreadsheet } = loadApp({
            'citation.saver.rate.limit.max': String(LIMIT),
            'citation.saver.rate.limit.window.ms': 60000,
        }));
        await translationsLoaded(app);
        // express-rate-limit reports an X-Forwarded-For header while "trust proxy" is off.
        consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

        for (let i = 0; i < LIMIT; i++) {
            const res = await post(app).type('form').send({ text: 'citation ' + i });
            expect(res.status).toBe(200);
            expect(res.body).toEqual(expect.objectContaining({ status: true }));
        }
    });

    afterAll(() => {
        consoleError.mockRestore();
    });

    it('replies 429 with the status:false JSON once the limit is reached', async () => {
        const res = await post(app).type('form').send({ text: 'one too many' });

        expect(res.status).toBe(429);
        expect(res.headers['content-type']).toMatch(/^application\/json/);
        expect(res.body).toEqual(tooMany);
        expect(res.headers['retry-after']).toMatch(/^\d+$/);
        expect(filesUnder(uploadFolder)).toEqual([]);
    });

    it('does not parse or store a file upload once the limit is reached', async () => {
        const res = await post(app)
            .attach('file', Buffer.from('%PDF-1.4\n%%EOF\n'), { filename: 'paper.pdf', contentType: 'application/pdf' });

        expect(res.status).toBe(429);
        expect(res.body).toEqual(tooMany);
        expect(filesUnder(uploadTempFolder)).toEqual([]);
        expect(filesUnder(uploadFolder)).toEqual([]);
    });

    it('cannot be bypassed with a spoofed X-Forwarded-For header while trust proxy is off', async () => {
        const res = await post(app).set('X-Forwarded-For', '203.0.113.7').type('form').send({ text: 'spoofed' });

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

describe('POST /services/citationsaver rate limit behind a trusted proxy', () => {
    it('counts each client IP from X-Forwarded-For separately', async () => {
        const { app } = loadApp({ 'citation.saver.rate.limit.max': '1', 'express.trust.proxy': '1' });
        const from = (ip) => post(app).set('X-Forwarded-For', ip).type('form').send({ text: 'from ' + ip });

        expect((await from('203.0.113.7')).status).toBe(200);
        expect((await from('203.0.113.7')).status).toBe(429);
        expect((await from('198.51.100.20')).status).toBe(200);
    });
});
