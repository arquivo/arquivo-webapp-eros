'use strict';

jest.mock('../../src/apis/page-search-api');
jest.mock('../../src/apis/image-search-api');
jest.mock('../../src/apis/cdx-api');
jest.mock('../../src/apis/suggestion-api');

const request = require('supertest');
const app = require('../../app');

describe('Security headers', () => {
    let res;

    beforeAll(async () => {
        res = await request(app).get('/');
    });

    it('removes X-Powered-By', () => {
        expect(res.headers['x-powered-by']).toBeUndefined();
    });
});
