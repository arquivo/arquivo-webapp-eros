'use strict';

const path = require('node:path');
const ejs = require('ejs');
const { asciiHost, displayUrl } = require('../utils/display-url');

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
    utils: { asciiHost, displayUrl, timestampToText: () => ({ medium: () => '' }) },
});

const renderedPageUrl = (html) => html.match(/<li><a href="javascript:void\(0\)" class="results-url" (.*)<\/li>/)[1];

describe('image result template: page address', () => {
    it('should show an ASCII address as is', async () => {
        const html = await renderImageResult('https://www.publico.pt/');

        expect(renderedPageUrl(html)).toBe('title="https://www.publico.pt/">→ https://www.publico.pt/</a>');
    });

    it('should show the ASCII host of an internationalised host under the address and in its title', async () => {
        const html = await renderImageResult('http://exämple.pt/');

        expect(renderedPageUrl(html)).toBe(
            'title="\u2068http://exämple.pt/\u2069 (xn--exmple-cua.pt)">→ http://exämple.pt/</a>'
            + '<span class="url-ascii-host" dir="ltr" translate="no">(xn--exmple-cua.pt)</span>');
    });
});
