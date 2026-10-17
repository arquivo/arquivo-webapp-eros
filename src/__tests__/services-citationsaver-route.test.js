'use strict';

// POST /services/citationsaver must hand a rejected handler Promise to Express's
// error handler via next() (#176). Without .catch(next) the rejection is unhandled,
// which exits Node >= 15, and the request never gets a response.

jest.mock('../../src/apis/page-search-api');
jest.mock('../../src/apis/image-search-api');
jest.mock('../../src/apis/cdx-api');
jest.mock('../../src/apis/suggestion-api');
jest.mock('../spreadsheet-client');
// Replace only the handler: the route's middlewares stay the real ones.
jest.mock('../services-citationsaver', () => {
    const actual = jest.requireActual('../services-citationsaver');
    return Object.assign(jest.fn(), { parseUpload: actual.parseUpload });
});

const request = require('supertest');
const citationSaver = require('../services-citationsaver');
const app = require('../../app');

// Fail fast instead of hanging Jest if the request never gets a response
const REQUEST_TIMEOUT_MS = 2000;

describe('POST /services/citationsaver', () => {
    let unhandledRejection;

    beforeEach(() => {
        jest.clearAllMocks();
        unhandledRejection = jest.fn();
        process.on('unhandledRejection', unhandledRejection);
    });

    afterEach(() => {
        process.off('unhandledRejection', unhandledRejection);
    });

    it('passes the handler with (req, res) and replies with its response', async () => {
        citationSaver.mockImplementation(async (req, res) => res.send({ status: true }));

        const res = await request(app).post('/services/citationsaver').type('form').send({ text: 'hello' })
            .timeout(REQUEST_TIMEOUT_MS);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: true });
        expect(citationSaver).toHaveBeenCalledTimes(1);
        expect(citationSaver.mock.calls[0][0].body).toEqual({ text: 'hello' });
    });

    it('sends a rejection of the handler to the Express error handler', async () => {
        citationSaver.mockRejectedValue(new Error('simulated handler failure'));

        const res = await request(app).post('/services/citationsaver').type('form').send({ text: 'hello' })
            .timeout(REQUEST_TIMEOUT_MS);
        await new Promise(resolve => setImmediate(resolve));

        expect(res.status).toBe(500);
        expect(res.text).toBe('Internal Server Error');
        expect(citationSaver).toHaveBeenCalledTimes(1);
        expect(unhandledRejection).not.toHaveBeenCalled();
    });
});
