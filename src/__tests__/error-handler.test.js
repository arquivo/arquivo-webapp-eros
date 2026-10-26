'use strict';

// The app's error middleware must be registered after the router so route
// errors reach it (#56). It logs 5xx stacks through the 'UnhandledException'
// logger (4xx at warn, without message or stack) and replies with the generic
// status text, so the response never depends on NODE_ENV and never includes a
// stack trace or server paths.

jest.mock('../../src/apis/page-search-api');
jest.mock('../../src/apis/image-search-api');
jest.mock('../../src/apis/cdx-api');
jest.mock('../../src/apis/suggestion-api');
jest.mock('../replay-nav', () => jest.fn());
// The handler is a mock; the route's middlewares just pass the request on.
jest.mock('../services-citationsaver', () => Object.assign(jest.fn(), {
    rateLimiter: (req, res, next) => next(),
    parseUpload: (req, res, next) => next(),
}));

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

    it('keeps the response generic when the app runs in development', async () => {
        // Express reads the env per request (app.get('env')), and its default
        // handler would put the stack in the body outside production.
        const previousEnv = app.get('env');
        app.set('env', 'development');
        try {
            replayNav.mockImplementation((req, res, next) => next(new Error('simulated route failure')));

            const res = await request(app).get('/partials/replay-nav').timeout(REQUEST_TIMEOUT_MS);

            expect(res.status).toBe(500);
            expect(res.text).toBe('Internal Server Error');
            expectNoStack(res.text);
        } finally {
            app.set('env', previousEnv);
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

    it('logs a client error at warn with only its status and name', async () => {
        // V8 quotes the start of the source in JSON.parse errors, so err.message
        // would carry raw request body text into the log.
        await request(app).post('/services/citationsaver')
            .set('Content-Type', 'application/json')
            .send('{"bodymarker": nope}')
            .timeout(REQUEST_TIMEOUT_MS);

        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        const line = mockLogger.warn.mock.calls[0][0];
        expect(line).toBe('Client error 400 SyntaxError');
        expect(line).not.toContain('bodymarker');
        expect(line).not.toMatch(/\n\s+at /);
    });

    it('falls back to 500 for a status that is not a 4xx integer', async () => {
        for (const status of ['404', 404.5, 302, 503]) {
            replayNav.mockImplementation((req, res, next) => next(Object.assign(new Error('simulated'), { status })));

            const res = await request(app).get('/partials/replay-nav').timeout(REQUEST_TIMEOUT_MS);

            expect(res.status).toBe(500);
            expect(res.text).toBe('Internal Server Error');
        }
    });

    it('stays robust to a non-Error value passed to next()', async () => {
        replayNav.mockImplementation((req, res, next) => next(Object.create(null)));

        const res = await request(app).get('/partials/replay-nav').timeout(REQUEST_TIMEOUT_MS);

        expect(res.status).toBe(500);
        expect(res.text).toBe('Internal Server Error');
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith('[non-Error value]');
    });

    it('drops the connection and logs once when headers were already sent', async () => {
        replayNav.mockImplementation((req, res, next) => {
            res.status(200).type('text/plain');
            res.write('partial body');
            next(new Error('simulated late failure'));
        });
        // Outside the test env, Express's default handler would console.error the
        // error a second time if the middleware handed it on with next(err).
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        const previousEnv = app.get('env');
        app.set('env', 'development');
        try {
            // The client sees a reset connection instead of a second, conflicting
            // reply (a hang would surface as a timeout instead).
            await expect(
                request(app).get('/partials/replay-nav').timeout(REQUEST_TIMEOUT_MS)
            ).rejects.toMatchObject({ code: 'ECONNRESET' });
            // Express defers its own logging to the next turn of the event loop
            await new Promise((resolve) => setImmediate(resolve));

            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('simulated late failure'));
            expect(consoleError).not.toHaveBeenCalled();
        } finally {
            app.set('env', previousEnv);
            consoleError.mockRestore();
        }
    });

    it('still serves the 404 page for unknown routes', async () => {
        const res = await request(app).get('/this-route-does-not-exist').timeout(REQUEST_TIMEOUT_MS);

        expect(res.status).toBe(404);
        expect(mockLogger.error).not.toHaveBeenCalled();
    });
});
