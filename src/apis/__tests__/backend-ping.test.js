jest.mock('config');
jest.mock('../../logger', () => () => ({ error: jest.fn(), info: jest.fn() }));

const pingBackend = require('../backend-ping');
const http = require('node:http');

describe('pingBackend', () => {
    let mockServer;
    let mockServerPort;
    let mockServerUrl;

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
    });
});
