'use strict';

const wayback = require('../wayback');

// Mock dependencies — config uses __mocks__/config.js automatically
jest.mock('config');
jest.mock('node-fetch');
jest.mock('../apis/page-search-api');

const fetch = require('node-fetch');
const PageSearchApiRequest = require('../apis/page-search-api');

// Helper to flush microtasks
const flushPromises = () => new Promise(resolve => setImmediate(resolve));

// Values from __mocks__/config.js
const PYWB_URL = 'https://preprod.arquivo.pt/noFrame/replay';

describe('wayback handler', () => {
    let req, res;
    let mockFetch;
    let mockApiRequest;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            url: '/wayback/20230101120000/example.com',
            getLanguage: jest.fn(() => 'pt')
        };

        res = {
            render: jest.fn(),
            redirect: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        // Mock fetch
        mockFetch = jest.fn().mockResolvedValue({
            ok: true,
            url: 'https://preprod.arquivo.pt/noFrame/replay/20230101120000/example.com',
            headers: new Map()
        });
        fetch.mockImplementation(mockFetch);

        // Mock API request
        mockApiRequest = {
            get: jest.fn((params, callback) => {
                callback({ response_items: [{ title: 'Example' }] });
            })
        };
        PageSearchApiRequest.mockImplementation(() => mockApiRequest);
    });

    it('fetches the wayback URL', async () => {
        wayback(req, res);
        await flushPromises();

        expect(mockFetch).toHaveBeenCalledWith(
            'https://preprod.arquivo.pt/noFrame/replay/20230101120000/example.com'
        );
    });

    it('renders replay page on successful fetch', async () => {
        wayback(req, res);
        await flushPromises();

        expect(res.render).toHaveBeenCalledWith('pages/replay', expect.objectContaining({
            requestedPage: {
                fullUrl: '20230101120000/example.com',
                url: 'example.com',
                timestamp: '20230101120000'
            }
        }));
    });

    it('renders 404 page when fetch fails', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        wayback(req, res);
        await flushPromises();

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.render).toHaveBeenCalledWith('pages/arquivo-404');
    });

    it('renders 404 page when response is not ok', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            url: 'https://preprod.arquivo.pt/noFrame/replay/20230101120000/example.com',
            headers: new Map()
        });

        wayback(req, res);
        await flushPromises();

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.render).toHaveBeenCalledWith('pages/arquivo-404');
    });

    it('requests API metadata for rendering', async () => {
        wayback(req, res);
        await flushPromises();

        expect(PageSearchApiRequest).toHaveBeenCalled();
        expect(mockApiRequest.get).toHaveBeenCalledWith(
            expect.any(URLSearchParams),
            expect.any(Function)
        );
    });

    it('sanitizes URL with leading/trailing slashes', async () => {
        req.url = '/wayback/20230101120000///example.com////';
        mockFetch.mockResolvedValueOnce({
            ok: true,
            url: 'https://preprod.arquivo.pt/noFrame/replay/20230101120000/example.com',
            headers: new Map()
        });

        wayback(req, res);
        await flushPromises();

        expect(res.render).toHaveBeenCalledWith('pages/replay', expect.objectContaining({
            requestedPage: expect.objectContaining({
                timestamp: '20230101120000',
                url: 'example.com'
            })
        }));
    });

    it('sanitizes URL with double slashes', async () => {
        req.url = '/wayback/20230101120000/example.com//path//to//page';
        mockFetch.mockResolvedValueOnce({
            ok: true,
            url: 'https://preprod.arquivo.pt/noFrame/replay/20230101120000/example.com/path/to/page',
            headers: new Map()
        });

        wayback(req, res);
        await flushPromises();

        expect(res.render).toHaveBeenCalledWith('pages/replay', expect.any(Object));
    });

    it('redirects from renderOk when pywb normalizes URL differently than req.url', async () => {
        // pywb redirects example.com → www.example.com (two fetches)
        // After recursion, renderOk is called with www.example.com,
        // which differs from the original req.url → triggers redirect
        req.url = '/wayback/20230101120000/example.com';

        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                url: `${PYWB_URL}/20230101120000/www.example.com`,
                headers: new Map()
            })
            .mockResolvedValueOnce({
                ok: true,
                url: `${PYWB_URL}/20230101120000/www.example.com`,
                headers: new Map()
            });

        wayback(req, res);
        await flushPromises();

        expect(res.redirect).toHaveBeenCalledWith('/wayback/20230101120000/www.example.com');
    });

    it('renders replay when fetch returns normalized URL', async () => {
        req.url = '/wayback/20230101120000//example.com/';
        mockFetch.mockResolvedValueOnce({
            ok: true,
            url: 'https://preprod.arquivo.pt/noFrame/replay/20230101120000/example.com',
            headers: new Map()
        });

        wayback(req, res);
        await flushPromises();

        expect(res.render).toHaveBeenCalledWith('pages/replay', expect.any(Object));
    });

    it('attaches language to rendered requestData', async () => {
        wayback(req, res);
        await flushPromises();

        expect(res.render).toHaveBeenCalledWith('pages/replay', expect.objectContaining({
            requestData: expect.any(URLSearchParams)
        }));
        const renderArgs = res.render.mock.calls[0][1];
        expect(renderArgs.requestData.get('l')).toBe('pt');
    });

    it('handles empty API response items', async () => {
        mockApiRequest.get.mockImplementationOnce((params, callback) => {
            callback({ response_items: [] });
        });

        wayback(req, res);
        await flushPromises();

        // empty array is truthy → response_items[0] = undefined
        expect(res.render).toHaveBeenCalledWith('pages/replay', expect.objectContaining({
            apiData: undefined
        }));
    });

    it('handles null API response', async () => {
        mockApiRequest.get.mockImplementationOnce((params, callback) => {
            callback({ response_items: null });
        });

        wayback(req, res);
        await flushPromises();

        expect(res.render).toHaveBeenCalled();
    });
});
