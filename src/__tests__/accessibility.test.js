/**
 * @jest-environment jsdom
 */

'use strict';

// jsdom does not ship TextEncoder/TextDecoder; polyfill before any require that needs them
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const request = require('supertest');
const { axe, toHaveNoViolations } = require('jest-axe');

// Mock API modules before app is loaded (jest.mock is hoisted automatically)
jest.mock('../../src/apis/page-search-api');
jest.mock('../../src/apis/image-search-api');
jest.mock('../../src/apis/cdx-api');
jest.mock('../../src/apis/suggestion-api');

const PageSearchApiRequest = require('../../src/apis/page-search-api');
const ImageSearchApiRequest = require('../../src/apis/image-search-api');
const CDXSearchApiRequest = require('../../src/apis/cdx-api');
const SuggestionApi = require('../../src/apis/suggestion-api');

const pageSearchFixture = {
    response_items: [
        {
            tstamp: '20200315120000',
            originalURL: 'http://example.com/artigo',
            linkToArchive: 'https://arquivo.pt/wayback/20200315120000/http://example.com/artigo',
            linkToScreenshot: 'https://arquivo.pt/screenshot/20200315120000/http://example.com/artigo',
            linkToExtractedText: 'https://arquivo.pt/text/20200315120000/http://example.com/artigo',
            collection: 'test-collection',
            mimeType: 'text/html',
            title: 'Artigo de Teste',
            snippet: 'Este é um excerto de teste da página arquivada.',
        },
    ],
};

const imageSearchFixture = {
    responseItems: [
        {
            imgSrc: 'https://arquivo.pt/image/20200101120000/http://example.com/img.jpg',
            imgTitle: 'Imagem de Teste',
            imgAlt: 'Imagem de exemplo arquivada',
            imgLinkToArchive: 'https://arquivo.pt/wayback/20200101120000/http://example.com/img.jpg',
            pageLinkToArchive: 'https://arquivo.pt/wayback/20200101120000/http://example.com/',
            imgMimeType: 'image/jpeg',
            imgHeight: 200,
            imgWidth: 300,
            imgTstamp: '20200101120000',
            pageTstamp: '20200101120000',
            pageURL: 'http://example.com/',
            pageTitle: 'Página de Teste',
            collection: 'test-collection',
            imgDigest: 'sha1:ABCDEF1234567890',
            pageHost: 'example.com',
            pageImages: 1,
            safe: 'on',
        },
    ],
};

// Timestamps must be older than 1 year to pass the embargo filter in cdxFilter
const cdxSearchFixture = [
    {
        url: 'http://arquivo.pt/',
        timestamp: '20200101120000',
        status: '200',
        digest: 'sha1:ABCDEF1234567890ABCDEF',
        mimetype: 'text/html',
    },
    {
        url: 'http://arquivo.pt/sobre',
        timestamp: '20210601080000',
        status: '200',
        digest: 'sha1:BCDEF1234567890ABCDEF0',
        mimetype: 'text/html',
    },
];

PageSearchApiRequest.mockImplementation(() => ({
    get: (requestData, callback) => callback(pageSearchFixture),
    sanitizeRequestData: (data) => data,
}));

ImageSearchApiRequest.mockImplementation(() => ({
    get: (requestData, callback) => callback(imageSearchFixture),
    sanitizeRequestData: (data) => data,
}));

CDXSearchApiRequest.mockImplementation(() => ({
    get: (requestData, callback) => callback(cdxSearchFixture),
}));

SuggestionApi.mockImplementation(() => ({
    getSuggestion: (query, lang, callback) => callback(null),
}));

expect.extend(toHaveNoViolations);

const app = require('../../app');

const WCAG_OPTIONS = {
    runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
    },
};

async function getHtml(url) {
    const res = await request(app).get(url);
    return res.text;
}

describe('Accessibility – WCAG 2.1 AA', () => {
    describe('Pages (no API dependency)', () => {
        it('/ – homepage', async () => {
            const results = await axe(await getHtml('/'), WCAG_OPTIONS);
            expect(results).toHaveNoViolations();
        });

        it('/pages – page search landing', async () => {
            const results = await axe(await getHtml('/pages'), WCAG_OPTIONS);
            expect(results).toHaveNoViolations();
        });

        it('/images – image search landing', async () => {
            const results = await axe(await getHtml('/images'), WCAG_OPTIONS);
            expect(results).toHaveNoViolations();
        });

        it('/page/search – results page shell', async () => {
            const results = await axe(await getHtml('/page/search?q=portugal'), WCAG_OPTIONS);
            expect(results).toHaveNoViolations();
        });

        it('/image/search – results page shell', async () => {
            const results = await axe(await getHtml('/image/search?q=portugal'), WCAG_OPTIONS);
            expect(results).toHaveNoViolations();
        });

        it('/url/search – URL history page shell', async () => {
            const results = await axe(await getHtml('/url/search?q=arquivo.pt'), WCAG_OPTIONS);
            expect(results).toHaveNoViolations();
        });

        it('/page/advanced/search – advanced page search', async () => {
            const results = await axe(await getHtml('/page/advanced/search'), WCAG_OPTIONS);
            expect(results).toHaveNoViolations();
        });

        it('/image/advanced/search – advanced image search', async () => {
            const results = await axe(await getHtml('/image/advanced/search'), WCAG_OPTIONS);
            expect(results).toHaveNoViolations();
        });

        it('/services/archivepagenow – archive page now form', async () => {
            const results = await axe(await getHtml('/services/archivepagenow'), WCAG_OPTIONS);
            expect(results).toHaveNoViolations();
        });

        it('/services/citationsaver – citation saver form', async () => {
            const results = await axe(await getHtml('/services/citationsaver'), WCAG_OPTIONS);
            expect(results).toHaveNoViolations();
        });
    });

    describe('Partials (mocked API responses)', () => {
        it('/partials/pages-search-results – page search results', async () => {
            const results = await axe(await getHtml('/partials/pages-search-results?q=portugal'), WCAG_OPTIONS);
            expect(results).toHaveNoViolations();
        });

        it('/partials/images-search-results – image search results', async () => {
            const results = await axe(await getHtml('/partials/images-search-results?q=portugal'), WCAG_OPTIONS);
            expect(results).toHaveNoViolations();
        });

        it('/partials/url-search-results – URL search results', async () => {
            const results = await axe(await getHtml('/partials/url-search-results?q=arquivo.pt'), WCAG_OPTIONS);
            expect(results).toHaveNoViolations();
        });
    });
});
