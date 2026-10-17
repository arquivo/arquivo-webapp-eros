'use strict';

const express = require('express');
const request = require('supertest');
const { parseTrustProxy } = require('../utils/trust-proxy');

// Mock config (auto-mocked)
jest.mock('config');
jest.mock('../logger', () => {
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
    return jest.fn(() => logger);
});

const tracking = require('../tracking');
const makeLogger = require('../logger');
const logger = makeLogger();

describe('tracking handler', () => {
    let req, res;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            url: '/page/view/TRACKING123/20230101120000/http%3A%2F%2Fexample.com',
            ip: '198.51.100.20',
            headers: {
                'x-forwarded-for': '192.168.1.1'
            },
            socket: {
                remoteAddress: '127.0.0.1'
            },
            get: jest.fn((header) => {
                if (header === 'user-agent') return 'Mozilla/5.0 Test';
                if (header === 'host') return 'arquivo.example';
                return null;
            }),
            protocol: 'https',
            originalUrl: '/page/view/TRACKING123/20230101120000/http%3A%2F%2Fexample.com',
            session: {
                id: 'session123'
            }
        };

        res = {
            redirect: jest.fn()
        };
    });

    it('redirects to wayback URL with timestamp and archived URL', () => {
        tracking(req, res, 'PageView');

        expect(res.redirect).toHaveBeenCalledWith(
            'https://preprod.arquivo.pt/wayback/20230101120000/http://example.com'
        );
    });

    it('works with ImageView type', () => {
        req.url = '/image/view/IMGTRACK456/20230102120000/http%3A%2F%2Fimage.example.com';

        tracking(req, res, 'ImageView');

        expect(res.redirect).toHaveBeenCalledWith(
            'https://preprod.arquivo.pt/wayback/20230102120000/http://image.example.com'
        );
    });

    it('logs one tab-separated line, in the same format as before', () => {
        tracking(req, res, 'PageView');

        expect(makeLogger).toHaveBeenCalledWith('PageViewTracking');
        expect(logger.info).toHaveBeenCalledTimes(1);
        expect(logger.info).toHaveBeenCalledWith("'198.51.100.20'\t\"Mozilla/5.0 Test\"\t"
            + "'https://arquivo.example/page/view/TRACKING123/20230101120000/http%3A%2F%2Fexample.com'\t"
            + "'TRACKING123'\t'session123'\t'20230101120000'\t'http://example.com'");
    });

    it('logs req.ip, never the X-Forwarded-For header nor the socket address', () => {
        req.headers['x-forwarded-for'] = '203.0.113.66, 10.0.0.1';

        tracking(req, res, 'PageView');

        const line = logger.info.mock.calls[0][0];
        expect(line).toMatch(/^'198\.51\.100\.20'\t/);
        expect(line).not.toContain('203.0.113.66');
        expect(line).not.toContain('127.0.0.1');
    });

    it('escapes control characters, so the archived URL cannot add a field or forge a line', () => {
        req.url = '/page/view/TRACKID/20230101120000/'
            + encodeURIComponent('http://example.com/\tx\r\n01/Jan/2026:00:00:00\tINFO\tFake\t-\tforged');

        tracking(req, res, 'PageView');

        const line = logger.info.mock.calls[0][0];
        expect(line).not.toMatch(/[\r\n]/);
        expect(line.split('\t')).toHaveLength(7);
        expect(line).toMatch(/\t'http:\/\/example\.com\/\\u0009x\\u000d\\u000a01\/Jan\/2026:00:00:00\\u0009INFO\\u0009Fake\\u0009-\\u0009forged'$/);
    });

    it('extracts tracking ID from URL path', () => {
        req.url = '/page/view/CUSTOM_TRACKING_ID/20230101120000/http%3A%2F%2Fexample.com';

        tracking(req, res, 'PageView');

        expect(res.redirect).toHaveBeenCalledWith(
            'https://preprod.arquivo.pt/wayback/20230101120000/http://example.com'
        );
    });

    it('extracts timestamp from URL path', () => {
        req.url = '/page/view/TRACKID/20231225235959/http%3A%2F%2Fexample.com';

        tracking(req, res, 'PageView');

        expect(res.redirect).toHaveBeenCalledWith(
            'https://preprod.arquivo.pt/wayback/20231225235959/http://example.com'
        );
    });

    it('correctly decodes archived URL from URL encoding', () => {
        req.url = '/page/view/TRACKID/20230101120000/https%3A%2F%2Fexample.com%2Fpath%3Fquery%3Dvalue';

        tracking(req, res, 'PageView');

        expect(res.redirect).toHaveBeenCalledWith(
            'https://preprod.arquivo.pt/wayback/20230101120000/https://example.com/path?query=value'
        );
    });

    it('handles archived URL with special characters', () => {
        req.url = '/page/view/TRACKID/20230101120000/http%3A%2F%2Fexample.com%2Fpath%20with%20spaces';

        tracking(req, res, 'PageView');

        expect(res.redirect).toHaveBeenCalledWith(
            'https://preprod.arquivo.pt/wayback/20230101120000/http://example.com/path with spaces'
        );
    });

    it('passes the type parameter to the function', () => {
        tracking(req, res, 'PageView');

        // Handler receives and logs type but doesn't use it in redirect
        expect(res.redirect).toHaveBeenCalled();
    });

    it('handles long tracking IDs', () => {
        req.url = '/page/view/VERY_LONG_TRACKING_ID_12345/20230101120000/http%3A%2F%2Fexample.com';

        tracking(req, res, 'PageView');

        expect(res.redirect).toHaveBeenCalledWith(
            'https://preprod.arquivo.pt/wayback/20230101120000/http://example.com'
        );
    });

    it('includes session ID in tracking context', () => {
        req.session = { id: 'unique-session-123' };

        tracking(req, res, 'PageView');

        expect(res.redirect).toHaveBeenCalled();
    });
});

describe('tracking route behind Express "trust proxy"', () => {
    // As app.js sets it from express.trust.proxy (EXPRESS_TRUST_PROXY)
    function appTrusting(setting) {
        const app = express();
        app.set('trust proxy', parseTrustProxy(setting));
        app.use((req, res, next) => {
            req.session = { id: 'session-1' };
            next();
        });
        app.get('/page/view/*', (req, res) => tracking(req, res, 'PageView'));
        return app;
    }
    const loggedIp = () => logger.info.mock.calls[0][0].split('\t')[0];

    beforeEach(() => jest.clearAllMocks());

    it('logs the TCP peer and ignores X-Forwarded-For when no proxy is trusted (the default)', async () => {
        await request(appTrusting(''))
            .get('/page/view/TRACKID/20230101120000/http%3A%2F%2Fexample.com')
            .set('X-Forwarded-For', '203.0.113.66')
            .expect(302);

        expect(loggedIp()).toMatch(/^'(::ffff:)?127\.0\.0\.1'$/);
    });

    it('logs only the address the trusted proxy saw, not one the client added', async () => {
        await request(appTrusting('1'))
            .get('/page/view/TRACKID/20230101120000/http%3A%2F%2Fexample.com')
            // The client sent "X-Forwarded-For: 203.0.113.66"; the proxy appended 198.51.100.7
            .set('X-Forwarded-For', '203.0.113.66, 198.51.100.7')
            .expect(302);

        expect(loggedIp()).toBe("'198.51.100.7'");
    });
});
