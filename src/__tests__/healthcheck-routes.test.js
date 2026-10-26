'use strict';

jest.mock('../../src/apis/page-search-api');
jest.mock('../../src/apis/image-search-api');
jest.mock('../../src/apis/cdx-api');
jest.mock('../../src/apis/suggestion-api');
jest.mock('../../src/apis/backend-ping');

const request = require('supertest');
const pingBackend = require('../../src/apis/backend-ping');
const app = require('../../app');

describe('GET /healthcheck', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('returns 200 with status:true for each backend when all are reachable', async () => {
        pingBackend.mockResolvedValue({ reachable: true, statusCode: 200 });

        const res = await request(app).get('/healthcheck');

        expect(res.status).toBe(200);
        expect(res.body.pageSearch).toEqual({ status: true, message: 'OK' });
        expect(res.body.imageSearch).toEqual({ status: true, message: 'OK' });
        expect(res.body.cdxj).toEqual({ status: true, message: 'OK' });
    });

    it('returns 503 with status:false and the error message for an unreachable backend', async () => {
        pingBackend.mockImplementation(async (url) => {
            if (url.includes('imagesearch')) {
                return { reachable: false, error: 'timeout' };
            }
            return { reachable: true, statusCode: 200 };
        });

        const res = await request(app).get('/healthcheck');

        expect(res.status).toBe(503);
        expect(res.body.imageSearch).toEqual({ status: false, message: 'timeout' });
        expect(res.body.pageSearch).toEqual({ status: true, message: 'OK' });
    });
});
