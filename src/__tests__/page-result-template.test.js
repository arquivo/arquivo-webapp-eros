'use strict';

const path = require('node:path');
const ejs = require('ejs');
const displayUrl = require('../utils/display-url');

const TEMPLATE = path.join(__dirname, '../../views/templates/fragments/page-result.ejs');

const renderPageResult = (query, title, originalURL = 'http://example.com/') => ejs.renderFile(TEMPLATE, {
    pageData: {
        originalURL,
        title,
        tstamp: '20230101120000',
        mimeType: 'text/html',
        snippet: '',
    },
    requestData: new URLSearchParams({ q: query }),
    prevUrl: null,
    index: 0,
    t: (key) => key,
    utils: { displayUrl },
}, { views: [path.join(__dirname, '../../views')] });

const renderedTitle = (html) => html.match(/<a class="results-title blockUrl">(.*)<\/a>/)[1];
const renderedUrl = (html) => html.match(/<a class="results-url blockUrl" title="[^"]*">(.*)<\/a>/)[1];

describe('page result template: search terms emphasized in the title', () => {
    it('should emphasize whole words of the query', async () => {
        const html = await renderPageResult('lisboa', 'Viver em Lisboa');

        expect(renderedTitle(html)).toBe('Viver em <em>Lisboa</em>');
    });

    it('should match the query terms literally, not as a pattern', async () => {
        const html = await renderPageResult('a.b', 'axb e a.b');

        expect(renderedTitle(html)).toBe('axb e <em>a.b</em>');
    });

    it.each([
        ['a(b'],
        ['a*b'],
        ['a[b'],
    ])('should emphasize terms with pattern characters, such as %s', async (term) => {
        const html = await renderPageResult(term, `antes ${term} depois`);

        expect(renderedTitle(html)).toBe(`antes <em>${term}</em> depois`);
    });

    it('should not emphasize anything for the empty terms of repeated spaces', async () => {
        const html = await renderPageResult('lisboa   noticias', 'Viver em Lisboa');

        expect(renderedTitle(html)).toBe('Viver em <em>Lisboa</em>');
    });

    it('should emphasize a repeated term once, without nesting the emphasis', async () => {
        const html = await renderPageResult('lisboa Lisboa LISBOA', 'Viver em Lisboa, lisboa');

        expect(renderedTitle(html)).toBe('Viver em <em>Lisboa</em>, lisboa');
    });

    it('should not emphasize again a word inside an emphasized phrase', async () => {
        const html = await renderPageResult('"viver em" viver', 'Viver em Lisboa, viver bem');

        expect(renderedTitle(html)).toBe('<em>Viver em</em> Lisboa, <em>viver</em> bem');
    });

    it('should emphasize only the first 32 distinct terms', async () => {
        const words = Array.from({ length: 40 }, (_, i) => `w${i}`);
        const html = await renderPageResult(words.join(' '), words.join(' '));

        const emphasized = words.slice(0, 32).map(word => `<em>${word}</em>`);
        expect(renderedTitle(html)).toBe([...emphasized, ...words.slice(32)].join(' '));
    });

    // Timing guards: Jest's timeout can't interrupt synchronous code, so the elapsed time is
    // asserted instead (the same applies to the other search term timing guards).

    // Regression: as a regular expression, this term took exponential time to match this title.
    it('should not take exponential time for terms that are costly as a pattern', async () => {
        const start = process.hrtime.bigint();
        const html = await renderPageResult('(a+)+b', 'a'.repeat(26));
        const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;

        expect(renderedTitle(html)).toBe('a'.repeat(26));
        expect(elapsedMs).toBeLessThan(200);
    });

    // Regression: each repeated term searched the title again, which grew with each emphasis.
    it('should take linear time in the number of repeated terms', async () => {
        const query = Array.from({ length: 20000 }, () => 'lisboa').join(' ');

        const start = process.hrtime.bigint();
        const html = await renderPageResult(query, 'Viver em Lisboa');
        const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;

        expect(elapsedMs).toBeLessThan(200);
        expect(renderedTitle(html)).toBe('Viver em <em>Lisboa</em>');
    });
});

describe('page result template: result address', () => {
    it('should show the address without its scheme', async () => {
        const html = await renderPageResult('lisboa', 'Lisboa', 'https://www.publico.pt/');

        expect(renderedUrl(html)).toBe('www.publico.pt');
    });

    it('should add the punycode form of an internationalised host', async () => {
        // `а` is CYRILLIC SMALL LETTER A (U+0430), not the Latin `a`.
        const html = await renderPageResult('paypal', 'PayPal', 'http://pаypal.com/login');

        expect(renderedUrl(html)).toBe('pаypal.com/login (xn--pypal-4ve.com)');
    });
});
