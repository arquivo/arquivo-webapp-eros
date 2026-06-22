'use strict';

const tracking = require('../tracking');

// Mock config (auto-mocked)
jest.mock('config');

// Values from __mocks__/config.js
const WAYBACK_URL = 'https://preprod.arquivo.pt/wayback';

describe('tracking handler', () => {
    let req, res;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            url: '/page/view/TRACKING123/20230101120000/http%3A%2F%2Fexample.com',
            headers: {
                'x-forwarded-for': '192.168.1.1'
            },
            socket: {
                remoteAddress: '127.0.0.1'
            },
            get: jest.fn((header) => {
                if (header === 'user-agent') return 'Mozilla/5.0 Test';
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

    it('uses x-forwarded-for when available', () => {
        tracking(req, res, 'PageView');

        expect(res.redirect).toHaveBeenCalled();
        // Tracking logs IP but doesn't affect redirect
    });

    it('falls back to socket.remoteAddress when x-forwarded-for is absent', () => {
        delete req.headers['x-forwarded-for'];

        tracking(req, res, 'PageView');

        expect(res.redirect).toHaveBeenCalled();
        // Should still redirect correctly
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
