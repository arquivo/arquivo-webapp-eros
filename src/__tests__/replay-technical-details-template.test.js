'use strict';

const path = require('node:path');
const ejs = require('ejs');
const isValidUrl = require('../utils/is-valid-url');
const displayUrl = require('../utils/display-url');

const TEMPLATE = path.join(__dirname, '../../views/partials/replay-technical-details.ejs');

const renderTechnicalDetails = (apiData) => ejs.renderFile(TEMPLATE, {
    apiData,
    t: (key) => key,
    utils: { isValidUrl, displayUrl },
});

const renderedRow = (html, key) =>
    html.match(new RegExp(`<li class="technical-details-row" data-key="${key}"><strong>${key}:</strong>(.*)</li>`))[1];

describe('replay technical details template: addresses', () => {
    it('should link an ASCII address and show it as is', async () => {
        const html = await renderTechnicalDetails({ originalURL: 'https://www.publico.pt/' });

        expect(renderedRow(html, 'originalURL'))
            .toBe('<a href="https://www.publico.pt/">https://www.publico.pt/</a>');
    });

    it('should show an internationalised host next to its punycode form, keeping the link', async () => {
        const html = await renderTechnicalDetails({ originalURL: 'http://exämple.pt/' });

        expect(renderedRow(html, 'originalURL'))
            .toBe('<a href="http://exämple.pt/">http://exämple.pt/ (xn--exmple-cua.pt)</a>');
    });

    it('should show a mixed-script lookalike host in punycode', async () => {
        // `а` is CYRILLIC SMALL LETTER A (U+0430), not the Latin `a`.
        const html = await renderTechnicalDetails({ linkToArchive: 'http://pаypal.com/login' });

        expect(renderedRow(html, 'linkToArchive'))
            .toBe('<a href="http://pаypal.com/login">http://pаypal.com/login (xn--pypal-4ve.com)</a>');
    });

    it('should show the punycode form for an address that is not linked', async () => {
        // A space in the query keeps this address from being linked.
        const html = await renderTechnicalDetails({ originalURL: 'http://exämple.pt/?q=a b' });

        expect(renderedRow(html, 'originalURL')).toBe('http://exämple.pt/?q=a b (xn--exmple-cua.pt)');
    });

    it('should show the other fields unchanged', async () => {
        const html = await renderTechnicalDetails({ title: 'Exämple', tstamp: '20230101120000', contentLength: 42 });

        expect(renderedRow(html, 'title')).toBe('Exämple');
        expect(renderedRow(html, 'tstamp')).toBe('20230101120000');
        expect(renderedRow(html, 'contentLength')).toBe('42');
    });

    it('should keep the address escaped', async () => {
        const html = await renderTechnicalDetails({ originalURL: 'http://exämple.pt/"><b>' });

        expect(renderedRow(html, 'originalURL'))
            .toBe('http://exämple.pt/&#34;&gt;&lt;b&gt; (xn--exmple-cua.pt)');
    });
});
