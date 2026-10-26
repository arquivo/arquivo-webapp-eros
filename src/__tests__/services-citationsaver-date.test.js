'use strict';

// The spreadsheet's first column is the submission date as YYYY-MM-DD in the
// server's local time zone. Jest runs with TZ=Pacific/Kiritimati (UTC+14, see
// jest.global-setup.js), so just after local midnight the UTC date is still the
// previous day: these tests fail if the column switches to UTC.

jest.mock('config');
jest.mock('node-fetch');
jest.mock('fs', () => ({
    ...jest.createMockFromModule('fs'),
    realpathSync: jest.requireActual('fs').realpathSync,
}));
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

fs.promises = { mkdir: jest.fn(), writeFile: jest.fn(), rm: jest.fn() };

const PDF_DATA = Buffer.from('%PDF-1.4\n%%EOF\n');

const flushPromises = async () => {
    for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve));
};

describe('Citation Saver spreadsheet date column', () => {
    const email = 'test@example.com';
    let req, res;

    beforeEach(() => {
        jest.clearAllMocks();
        // Fake only Date, so the promise and setImmediate plumbing keeps running.
        jest.useFakeTimers({
            doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout',
                'setInterval', 'clearInterval', 'queueMicrotask'],
        });

        req = { body: {}, files: null, t: jest.fn((key) => key) };
        res = { send: jest.fn() };
        res.status = jest.fn(() => res);

        fetch.mockResolvedValue({
            ok: true,
            headers: new Map([['content-type', 'application/pdf'], ['content-length', '5000']])
        });
        fs.promises.mkdir.mockResolvedValue(undefined);
        fs.promises.writeFile.mockResolvedValue(undefined);
        fs.promises.rm.mockResolvedValue(undefined);
        fs.createReadStream.mockImplementation((path, { start = 0, end = Infinity } = {}) =>
            Readable.from([PDF_DATA.subarray(start, end + 1)]));
        isValidUrl.mockReturnValue(true);
        addToSpreadsheet.mockResolvedValue();
        dns.lookup.mockImplementation((hostname, opts, cb) => cb(null, [{ address: '93.184.216.34', family: 4 }]));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    const submissions = {
        File: () => ({
            body: { email },
            files: { file: { name: 'doc.pdf', mimetype: 'application/pdf', size: 5000, mv: jest.fn() } }
        }),
        Link: () => ({ body: { email, url: 'http://example.com' }, files: null }),
        Text: () => ({ body: { email, text: 'Sample text' }, files: null }),
    };

    describe.each(Object.keys(submissions))('a %s submission', (type) => {
        it('records the local date just after local midnight', async () => {
            const now = new Date(2024, 0, 1, 0, 0, 1);
            jest.setSystemTime(now);
            Object.assign(req, submissions[type]());

            servicesCitationSaver(req, res);
            await flushPromises();

            expect(addToSpreadsheet).toHaveBeenCalledTimes(1);
            const row = addToSpreadsheet.mock.calls[0][0];
            expect(row[3]).toBe(type);
            expect(row[0]).toBe('2024-01-01');
            expect(row[1]).toBe(now.getTime());
        });
    });
});
