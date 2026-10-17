'use strict';

const path = require('node:path');
const ejs = require('ejs');
const displayUrl = require('../utils/display-url');

const TEMPLATE = path.join(__dirname, '../../views/templates/fragments/image-result.ejs');

const renderImageResult = (pageURL) => ejs.renderFile(TEMPLATE, {
    imageData: {
        index: 1,
        imgSrc: 'http://example.com/image.png',
        imgTstamp: '20230101120000',
        imgLinkToArchive: 'https://arquivo.pt/noFrame/replay/20230101120000im_/http://example.com/image.png',
        pageURL,
    },
    requestData: new URLSearchParams(),
    config: { has: () => false },
    t: (key) => key,
    utils: { displayUrl, timestampToText: () => ({ medium: () => '' }) },
});

const renderedPageUrl = (html) => html.match(/<a href="javascript:void\(0\)" class="results-url" title="[^"]*">→ (.*)<\/a>/)[1];

describe('image result template: page address', () => {
    it('should show an ASCII address as is', async () => {
        const html = await renderImageResult('https://www.publico.pt/');

        expect(renderedPageUrl(html)).toBe('https://www.publico.pt/');
    });

    it('should add the punycode form of an internationalised host', async () => {
        const html = await renderImageResult('http://exämple.pt/');

        expect(renderedPageUrl(html)).toBe('http://exämple.pt/ (xn--exmple-cua.pt)');
    });
});
