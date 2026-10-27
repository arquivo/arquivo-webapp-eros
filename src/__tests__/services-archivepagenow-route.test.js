'use strict';

// The ArchivePageNow routes: the form submits with GET to /services/archivepagenow/save,
// while a plain GET of /services/archivepagenow only pre-fills the form.

jest.mock('node-fetch');
jest.mock('../../src/apis/page-search-api');
jest.mock('../../src/apis/image-search-api');
jest.mock('../../src/apis/cdx-api');
jest.mock('../../src/apis/suggestion-api');

const request = require('supertest');
const fetch = require('node-fetch');
const app = require('../../app');

// Each page is told apart by its <body> id
const FORM_PAGE = '<body id="archivepagenow"';
const SAVE_PAGE = '<body id="archivepagenow-landing"';
// services.archivepagenow.url in __mocks__/config.js
const RECORDER_SRC = 'src="https://preprod.arquivo.pt/services/save/http://example.com"';

describe('ArchivePageNow routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // The backend logging request never leaves the test
        fetch.mockResolvedValue({});
    });

    describe('GET /services/archivepagenow (the form)', () => {
        it('submits with GET to its own path, with the language in a field', async () => {
            const res = await request(app).get('/services/archivepagenow?l=en');

            expect(res.status).toBe(200);
            expect(res.text).toContain('<form id="search-form" role="form" action="/services/archivepagenow/save" method="GET">');
            expect(res.text).toContain('<input type="hidden" name="l" value="en">');
            expect(res.text).not.toMatch(/method="POST"/i);
        });

        it('does not send the consent checkboxes with the form', async () => {
            const res = await request(app).get('/services/archivepagenow');

            expect(res.text).toContain('<input type="checkbox" id="consent-protection" form="search-form" required autofocus>');
            expect(res.text).toContain('<input type="checkbox" id="consent-processing" form="search-form" required>');
            expect(res.text).not.toContain('name="consent-');
        });

        it('only pre-fills the form from a url parameter, without archiving', async () => {
            const res = await request(app).get('/services/archivepagenow?url=http://example.com');

            expect(res.status).toBe(200);
            expect(res.text).toContain(FORM_PAGE);
            expect(res.text).not.toContain(SAVE_PAGE);
            expect(res.text).toContain('value="http://example.com"');
            expect(fetch).not.toHaveBeenCalled();
        });

        it('keeps the backward-compatible /services/savepagenow redirect on the pre-fill page', async () => {
            const res = await request(app).get('/services/savepagenow?url=http://example.com');

            expect(res.status).toBe(302);
            expect(res.headers.location).toBe('/services/archivepagenow?url=http%3A%2F%2Fexample.com');
        });
    });

    describe('GET /services/archivepagenow/save (a submission)', () => {
        it('renders the recorder page for a valid URL and logs the attempt', async () => {
            const res = await request(app).get('/services/archivepagenow/save?url=http://example.com');

            expect(res.status).toBe(200);
            expect(res.text).toContain(SAVE_PAGE);
            expect(res.text).toContain(RECORDER_SRC);
            expect(fetch).toHaveBeenCalledTimes(1);
            expect(fetch).toHaveBeenCalledWith(expect.stringContaining('&success=true&logging=true'), { method: 'POST' });
        });

        it('renders the form with the error for an invalid URL', async () => {
            const res = await request(app).get('/services/archivepagenow/save?url=not%20a%20url');

            expect(res.status).toBe(200);
            expect(res.text).toContain(FORM_PAGE);
            expect(res.text).not.toContain(SAVE_PAGE);
            expect(res.text).toContain('<p id="save-page-url-message-error">');
            expect(fetch).toHaveBeenCalledWith(expect.stringContaining('&success=false&logging=true'), { method: 'POST' });
        });

        it('renders the error when the url is missing', async () => {
            const res = await request(app).get('/services/archivepagenow/save');

            expect(res.status).toBe(200);
            expect(res.text).toContain('<p id="save-page-url-message-error">');
        });

        it('keeps the language of the submitted form', async () => {
            const res = await request(app).get('/services/archivepagenow/save?url=http://example.com&l=en');

            expect(res.text).toContain(SAVE_PAGE);
            expect(res.text).toContain('<html lang="en">');
        });

        it('keeps the language on the error page', async () => {
            const res = await request(app).get('/services/archivepagenow/save?url=not%20a%20url&l=en');

            expect(res.text).toContain('<html lang="en">');
            expect(res.text).toContain('<input type="hidden" name="l" value="en">');
        });
    });

    describe('POST /services/archivepagenow', () => {
        it('only acknowledges the backend logging request, with an empty 200', async () => {
            const res = await request(app)
                .post('/services/archivepagenow?url=http%3A%2F%2Fexample.com&success=true&logging=true'
                    + '&user-agent=agent&ip=127.0.0.1');

            expect(res.status).toBe(200);
            expect(res.text).toBe('');
            expect(fetch).not.toHaveBeenCalled();
        });

        it('redirects a form submitted with POST to the same submission with GET', async () => {
            const res = await request(app)
                .post('/services/archivepagenow?l=en')
                .type('form').send({ url: 'http://example.com/a?b=1&c=2', 'consent-protection': 'on' });

            expect(res.status).toBe(303);
            expect(res.headers.location)
                .toBe('/services/archivepagenow/save?url=http%3A%2F%2Fexample.com%2Fa%3Fb%3D1%26c%3D2&l=en');
            expect(fetch).not.toHaveBeenCalled();
        });

        it('redirects to a submission that renders the recorder page', async () => {
            const posted = await request(app)
                .post('/services/archivepagenow?l=en')
                .type('form').send({ url: 'http://example.com' });
            const res = await request(app).get(posted.headers.location);

            expect(res.text).toContain(SAVE_PAGE);
            expect(res.text).toContain(RECORDER_SRC);
            expect(res.text).toContain('<html lang="en">');
        });

        it('redirects a POST without a url to a submission that renders the error', async () => {
            const posted = await request(app).post('/services/archivepagenow');

            expect(posted.status).toBe(303);
            expect(posted.headers.location).toBe('/services/archivepagenow/save?url=');
            const res = await request(app).get(posted.headers.location);
            expect(res.text).toContain('<p id="save-page-url-message-error">');
        });
    });
});
