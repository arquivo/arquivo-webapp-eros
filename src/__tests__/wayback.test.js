'use strict';

// Mock dependencies — config uses __mocks__/config.js automatically
jest.mock('config');
jest.mock('node-fetch');
jest.mock('../apis/page-search-api');
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
jest.mock('../logger', () => () => mockLogger);

const wayback = require('../wayback');

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

    // #180: the replay URL tells which page the user is reading, so it stays at debug.
    describe('logging (#180)', () => {
        const page = 'jane-doe.example.pt/private?token=s3cr3t';
        const logged = (...levels) => levels.flatMap(level => mockLogger[level].mock.calls.flat().map(String)).join('\n');

        beforeEach(() => {
            req.url = '/wayback/20230101120000/' + page;
        });

        it('keeps the URL of a failed fetch to the debug log', async () => {
            const error = Object.assign(new Error(`request to ${PYWB_URL}/20230101120000/${page} failed, reason: \r\nforged`),
                { name: 'FetchError', type: 'system', code: 'ECONNREFUSED' });
            mockFetch.mockRejectedValueOnce(error);

            wayback(req, res);
            await flushPromises();

            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to fetch the replay URL. Reason: name: "FetchError", type: "system", code: "ECONNREFUSED"');
            expect(logged('info', 'warn', 'error')).not.toContain('jane-doe');
            expect(logged('debug')).toContain(page);
            expect(logged('debug')).toContain('\\u000d\\u000aforged');
            expect(logged('debug')).not.toMatch(/[\r\n]forged/);
        });

        it('keeps the URL of a response that is not ok to the debug log', async () => {
            mockFetch.mockResolvedValueOnce({ ok: false, status: 502, url: `${PYWB_URL}/20230101120000/${page}`, headers: new Map() });

            wayback(req, res);
            await flushPromises();

            expect(mockLogger.error).toHaveBeenCalledWith('Something went wrong while trying to fetch the replay URL. Status: 502');
            expect(logged('info', 'warn', 'error')).not.toContain('jane-doe');
            expect(mockLogger.debug).toHaveBeenCalledWith(`Replay URL: ${PYWB_URL}/20230101120000/${page}`);
        });
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

    describe('splitting the timestamp from the archived URL', () => {
        it('keeps every later "/" in the archived URL', async () => {
            req.url = '/wayback/20230101120000/example.com/a/b';
            mockFetch.mockResolvedValueOnce({
                ok: true,
                url: `${PYWB_URL}/20230101120000/example.com/a/b`,
                headers: new Map()
            });

            wayback(req, res);
            await flushPromises();

            expect(res.render).toHaveBeenCalledWith('pages/replay', expect.objectContaining({
                requestedPage: {
                    fullUrl: '20230101120000/example.com/a/b',
                    url: 'example.com/a/b',
                    timestamp: '20230101120000'
                }
            }));
        });

        it('uses an empty archived URL when there is no "/" after the timestamp', async () => {
            req.url = '/wayback/20230101120000';
            mockFetch.mockResolvedValueOnce({
                ok: true,
                url: `${PYWB_URL}/20230101120000`,
                headers: new Map()
            });

            wayback(req, res);
            await flushPromises();

            expect(res.render).toHaveBeenCalledWith('pages/replay', expect.objectContaining({
                requestedPage: {
                    fullUrl: '20230101120000',
                    url: '',
                    timestamp: '20230101120000'
                }
            }));
        });
    });

    describe('stripping the pywb prefix from the fetched URL', () => {
        it('strips only up to the first "replay/" when the archived URL also contains it', async () => {
            req.url = '/wayback/20230101120000/example.com/replay/page';
            mockFetch.mockResolvedValueOnce({
                ok: true,
                url: `${PYWB_URL}/20230101120000/example.com/replay/page`,
                headers: new Map()
            });

            wayback(req, res);
            await flushPromises();

            expect(res.render).toHaveBeenCalledWith('pages/replay', expect.objectContaining({
                requestedPage: {
                    fullUrl: '20230101120000/example.com/replay/page',
                    url: 'example.com/replay/page',
                    timestamp: '20230101120000'
                }
            }));
        });

        it('follows a redirect that leaves pywb with an empty path when "replay/" is absent', async () => {
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    url: 'https://other.example/20230101120000/example.com',
                    headers: new Map()
                })
                .mockRejectedValueOnce(new Error('stop'));

            wayback(req, res);
            await flushPromises();

            expect(mockFetch).toHaveBeenNthCalledWith(2, `${PYWB_URL}/`);
            expect(res.status).toHaveBeenCalledWith(404);
        });
    });

    describe('non-numeric timestamp (#56)', () => {
        beforeEach(() => {
            req.url = '/wayback/20230101120000id_/example.com';
            mockFetch.mockResolvedValueOnce({
                ok: true,
                url: `${PYWB_URL}/20230101120000id_/example.com`,
                headers: new Map()
            });
        });

        it('redirects to pywb once and stops instead of also rendering the replay page', async () => {
            wayback(req, res);
            await flushPromises();

            expect(res.redirect).toHaveBeenCalledTimes(1);
            expect(res.redirect).toHaveBeenCalledWith(`${PYWB_URL}/20230101120000id_/example.com`);
            expect(PageSearchApiRequest).not.toHaveBeenCalled();
            expect(res.render).not.toHaveBeenCalled();
        });

        it('does not leak newUrl into the global scope', async () => {
            wayback(req, res);
            await flushPromises();

            expect(globalThis).not.toHaveProperty('newUrl');
        });
    });
});
