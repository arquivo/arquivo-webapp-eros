'use strict';

jest.mock('config');
const mockLogger = { error: jest.fn(), info: jest.fn() };
jest.mock('../../logger', () => () => mockLogger);

const pingBackend = require('../backend-ping');
const http = require('node:http');

describe('pingBackend', () => {
    let mockServer;
    let mockServerPort;
    let mockServerUrl;
    let onTrickleBodyClose = () => {};

    beforeAll((done) => {
        mockServer = http.createServer((req, res) => {
            if (req.url === '/not-found') {
                res.writeHead(404);
                res.end('not found');
                return;
            }
            if (req.url === '/redirect') {
                res.writeHead(307, { Location: '/somewhere-else' });
                res.end();
                return;
            }
            if (req.url === '/trickle') {
                // a status line, then a header every 20ms, never ending the headers: the socket is never idle
                req.socket.write('HTTP/1.1 200 OK\r\n');
                const drip = setInterval(() => req.socket.write('X-Drip: 1\r\n'), 20);
                req.socket.on('close', () => clearInterval(drip));
                return;
            }
            if (req.url === '/trickle-body') {
                // a 200, then a body that keeps coming: a byte every 20ms, never ending
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                const drip = setInterval(() => res.write('.'), 20);
                res.on('close', () => {
                    clearInterval(drip);
                    onTrickleBodyClose();
                });
                return;
            }
            if (req.url === '/hang') {
                // never respond, to trigger the caller's timeout
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('ok');
        });
        mockServer.listen(0, () => {
            mockServerPort = mockServer.address().port;
            mockServerUrl = `http://localhost:${mockServerPort}`;
            done();
        });
    });

    afterAll((done) => {
        mockServer.close(done);
    });

    beforeEach(() => {
        mockLogger.error.mockClear();
    });

    it('resolves reachable:true for a 2xx response', async () => {
        const result = await pingBackend(mockServerUrl);
        expect(result).toEqual({ reachable: true, statusCode: 200 });
    });

    it('resolves reachable:false for a non-2xx response (e.g. wrong path or bad request)', async () => {
        const result = await pingBackend(`${mockServerUrl}/not-found`);
        expect(result).toEqual({ reachable: false, statusCode: 404, error: 'HTTP 404' });
    });

    it('resolves reachable:false for a 3xx redirect (e.g. pywb treating a wrong path as a URL lookup)', async () => {
        const result = await pingBackend(`${mockServerUrl}/redirect`);
        expect(result).toEqual({ reachable: false, statusCode: 307, error: 'HTTP 307' });
    });

    it('resolves reachable:false on connection error', async () => {
        const result = await pingBackend('http://127.0.0.1:1');
        expect(result.reachable).toBe(false);
        expect(result.error).toBeDefined();
    });

    it('resolves reachable:false on timeout', async () => {
        const result = await pingBackend(`${mockServerUrl}/hang`, 50);
        expect(result).toEqual({ reachable: false, error: 'timeout' });
        expect(mockLogger.error).toHaveBeenCalledWith(`${mockServerUrl}/hang : Timeout (50ms)`);
    });

    it('resolves reachable:false on timeout when the backend keeps sending without completing its reply', async () => {
        const start = Date.now();
        const result = await pingBackend(`${mockServerUrl}/trickle`, 100);
        expect(result).toEqual({ reachable: false, error: 'timeout' });
        expect(Date.now() - start).toBeLessThan(1000);
    });

    it('does not log a timeout for a backend it reported reachable when the deadline cuts the body', async () => {
        const bodyClosed = new Promise((resolve) => { onTrickleBodyClose = resolve; });
        const result = await pingBackend(`${mockServerUrl}/trickle-body`, 100);
        expect(result).toEqual({ reachable: true, statusCode: 200 });
        // the deadline still closes the connection of the body being drained...
        await bodyClosed;
        // ...but the backend was already reported reachable, so it is not logged as a timeout
        expect(mockLogger.error).not.toHaveBeenCalled();
    });
});
