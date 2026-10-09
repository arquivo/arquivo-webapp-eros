'use strict';

const wayback = require('../wayback');

// Mock dependencies — config uses __mocks__/config.js automatically
jest.mock('config');
jest.mock('../apis/page-search-api');

const PageSearchApiRequest = require('../apis/page-search-api');

describe('wayback handler', () => {
    let req, res;
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

        mockApiRequest = {
            get: jest.fn((params, callback) => {
                callback({ response_items: [{ title: 'Example' }] });
            })
        };
        PageSearchApiRequest.mockImplementation(() => mockApiRequest);
    });

    it('renders replay page for a valid timestamp and url', () => {
        wayback(req, res);

        expect(res.render).toHaveBeenCalledWith('pages/replay', expect.objectContaining({
            requestedPage: {
                fullUrl: '20230101120000/example.com',
                url: 'example.com',
                timestamp: '20230101120000'
            }
        }));
    });

    it('renders replay page for a url with path segments', () => {
        req.url = '/wayback/20230101120000/example.com/path/to/page';

        wayback(req, res);

        expect(res.render).toHaveBeenCalledWith('pages/replay', expect.objectContaining({
            requestedPage: {
                fullUrl: '20230101120000/example.com/path/to/page',
                url: 'example.com/path/to/page',
                timestamp: '20230101120000'
            }
        }));
    });

    it('renders 404 when the url segment is missing', () => {
        req.url = '/wayback/20230101120000';

        wayback(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.render).toHaveBeenCalledWith('pages/arquivo-404');
        expect(PageSearchApiRequest).not.toHaveBeenCalled();
    });

    it('renders 404 when the path is empty', () => {
        req.url = '/wayback/';

        wayback(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.render).toHaveBeenCalledWith('pages/arquivo-404');
    });

    it('renders 404 when there is no path at all', () => {
        req.url = '/wayback';

        wayback(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.render).toHaveBeenCalledWith('pages/arquivo-404');
    });

    it('redirects to a clean timestamp when the pywb modifier is present', () => {
        req.url = '/wayback/20220907152857mp_/example.com';

        wayback(req, res);

        expect(res.redirect).toHaveBeenCalledWith('/wayback/20220907152857/example.com');
        expect(res.render).not.toHaveBeenCalled();
        expect(PageSearchApiRequest).not.toHaveBeenCalled();
    });

    it('requests API metadata with the url/timestamp before rendering', () => {
        wayback(req, res);

        expect(PageSearchApiRequest).toHaveBeenCalled();
        expect(mockApiRequest.get).toHaveBeenCalledWith(
            expect.any(URLSearchParams),
            expect.any(Function)
        );
        const params = mockApiRequest.get.mock.calls[0][0];
        expect(params.get('metadata')).toBe('example.com/20230101120000');
    });

    it('passes the first response item as apiData', () => {
        wayback(req, res);

        expect(res.render).toHaveBeenCalledWith('pages/replay', expect.objectContaining({
            apiData: { title: 'Example' }
        }));
    });

    it('passes an empty apiData object when response_items is null', () => {
        mockApiRequest.get.mockImplementationOnce((params, callback) => {
            callback({ response_items: null });
        });

        wayback(req, res);

        expect(res.render).toHaveBeenCalledWith('pages/replay', expect.objectContaining({
            apiData: {}
        }));
    });

    it('passes undefined apiData when response_items is an empty array', () => {
        mockApiRequest.get.mockImplementationOnce((params, callback) => {
            callback({ response_items: [] });
        });

        wayback(req, res);

        expect(res.render).toHaveBeenCalledWith('pages/replay', expect.objectContaining({
            apiData: undefined
        }));
    });

    it('attaches language to rendered requestData', () => {
        wayback(req, res);

        const renderArgs = res.render.mock.calls[0][1];
        expect(renderArgs.requestData).toBeInstanceOf(URLSearchParams);
        expect(renderArgs.requestData.get('l')).toBe('pt');
    });
});
