'use strict';

const express = require('express');
const request = require('supertest');

// config uses __mocks__/config.js
jest.mock('config');

const backendRoutes = require('../backend-routes');

const PYWB_URL = 'https://preprod.arquivo.pt/noFrame/replay';

describe('backend routes (/wayback/cdx, /wayback/timemap)', () => {
    let app;

    beforeEach(() => {
        app = express();
        backendRoutes(app);
    });

    it('redirects /wayback/cdx to pywb without the "wayback" token', async () => {
        const res = await request(app).get('/wayback/cdx?url=example.com&output=json');

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe(`${PYWB_URL}/cdx?url=example.com&output=json`);
    });

    it('redirects /wayback/timemap/<path> to pywb without the "wayback" token', async () => {
        const res = await request(app).get('/wayback/timemap/link/example.com');

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe(`${PYWB_URL}/timemap/link/example.com`);
    });

    // transformUrl re-joins the pieces with '' rather than with the token, so it
    // removes EVERY "wayback", not just the first. These tests pin that current
    // behaviour; it is not a plain "slice after the first token".
    it('also removes later occurrences of "wayback" in the query', async () => {
        const res = await request(app).get('/wayback/cdx?url=arquivo.pt/wayback/page');

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe(`${PYWB_URL}/cdx?url=arquivo.pt//page`);
    });

    // Express routes match case-insensitively, so the route can match a path
    // without a lower-case "wayback"; the token is then absent and the whole
    // path and query are dropped.
    it('redirects to the bare pywb URL when the "wayback" token is absent', async () => {
        const res = await request(app).get('/WAYBACK/cdx?url=example.com');

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe(PYWB_URL);
    });
});
