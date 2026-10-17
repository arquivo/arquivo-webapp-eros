'use strict';

// The app's error middleware must be registered after the router so route
// errors reach it (#56). It logs the stack through the 'UnhandledException'
// logger and replies with a generic message, so the response never depends on
// NODE_ENV and never includes a stack trace or server paths.

jest.mock('../../src/apis/page-search-api');
jest.mock('../../src/apis/image-search-api');
jest.mock('../../src/apis/cdx-api');
jest.mock('../../src/apis/suggestion-api');
jest.mock('../replay-nav', () => jest.fn());
jest.mock('../services-citationsaver', () => jest.fn());

const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
jest.mock('../logger', () => jest.fn(() => mockLogger));

const request = require('supertest');
const loggerFactory = require('../logger');
const replayNav = require('../replay-nav');
const citationSaver = require('../services-citationsaver');
const app = require('../../app');

// Labels of the loggers created while loading the app, before any mock is cleared
const loggerLabels = loggerFactory.mock.calls.map(([label]) => label);

// Fail fast instead of hanging Jest if a request never gets a response
const REQUEST_TIMEOUT_MS = 2000;

const expectNoStack = (text) => {
    expect(text).not.toMatch(/\bat\s/);
    expect(text).not.toContain(__dirname.split('/src/')[0]);
    expect(text).not.toContain('node_modules');
    expect(text).not.toContain('simulated');
};

describe('error middleware', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('creates the UnhandledException logger', () => {
        expect(loggerLabels).toContain('UnhandledException');
    });

    it('replies with a generic 500 and logs the stack when a route calls next(err)', async () => {
        replayNav.mockImplementation((req, res, next) => next(new Error('simulated route failure')));

        const res = await request(app).get('/partials/replay-nav').timeout(REQUEST_TIMEOUT_MS);

        expect(res.status).toBe(500);
        expect(res.headers['content-type']).toMatch(/^text\/plain/);
        expect(res.text).toBe('Internal Server Error');
        expectNoStack(res.text);
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error: simulated route failure'));
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringMatching(/\n\s+at /));
    });

    it('replies with a generic 500 when a route throws synchronously', async () => {
        replayNav.mockImplementation(() => {
            throw new TypeError('simulated synchronous failure');
        });

        const res = await request(app).get('/partials/replay-nav').timeout(REQUEST_TIMEOUT_MS);

        expect(res.status).toBe(500);
        expect(res.text).toBe('Internal Server Error');
        expectNoStack(res.text);
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('TypeError: simulated synchronous failure'));
    });

    it('replies with a generic 500 when an async handler rejects', async () => {
        citationSaver.mockRejectedValue(new Error('simulated handler failure'));

        const res = await request(app).post('/services/citationsaver').type('form').send({ text: 'hello' })
            .timeout(REQUEST_TIMEOUT_MS);

        expect(res.status).toBe(500);
        expect(res.text).toBe('Internal Server Error');
        expectNoStack(res.text);
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('simulated handler failure'));
    });

    it('keeps the response independent of NODE_ENV', async () => {
        const previousEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';
        try {
            replayNav.mockImplementation((req, res, next) => next(new Error('simulated route failure')));

            const res = await request(app).get('/partials/replay-nav').timeout(REQUEST_TIMEOUT_MS);

            expect(res.status).toBe(500);
            expect(res.text).toBe('Internal Server Error');
        } finally {
            process.env.NODE_ENV = previousEnv;
        }
    });

    it('keeps the 4xx status of a client error, with a generic message', async () => {
        const res = await request(app).post('/services/citationsaver')
            .set('Content-Type', 'application/json')
            .send('{"not json')
            .timeout(REQUEST_TIMEOUT_MS);

        expect(res.status).toBe(400);
        expect(res.text).toBe('Bad Request');
        expectNoStack(res.text);
        expect(citationSaver).not.toHaveBeenCalled();
    });

    it('delegates to Express with next(err) when headers were already sent', async () => {
        replayNav.mockImplementation((req, res, next) => {
            res.status(200).type('text/plain');
            res.write('partial body');
            next(new Error('simulated late failure'));
        });

        // Express's default handler closes the connection mid-response, so the
        // client sees an aborted request instead of a second, conflicting reply.
        await expect(
            request(app).get('/partials/replay-nav').timeout(REQUEST_TIMEOUT_MS)
        ).rejects.toThrow();
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('simulated late failure'));
    });

    it('still serves the 404 page for unknown routes', async () => {
        const res = await request(app).get('/this-route-does-not-exist').timeout(REQUEST_TIMEOUT_MS);

        expect(res.status).toBe(404);
        expect(mockLogger.error).not.toHaveBeenCalled();
    });
});
