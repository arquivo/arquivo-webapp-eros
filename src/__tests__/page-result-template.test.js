const path = require('node:path');
const ejs = require('ejs');

const TEMPLATE = path.join(__dirname, '../../views/templates/fragments/page-result.ejs');

const renderPageResult = (query, title) => ejs.renderFile(TEMPLATE, {
    pageData: {
        originalURL: 'http://example.com/',
        title,
        tstamp: '20230101120000',
        mimeType: 'text/html',
        snippet: '',
    },
    requestData: new URLSearchParams({ q: query }),
    prevUrl: null,
    index: 0,
    t: (key) => key,
}, { views: [path.join(__dirname, '../../views')] });

const renderedTitle = (html) => html.match(/<a class="results-title blockUrl">(.*)<\/a>/)[1];

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

    // Regression: as a regular expression, this term took exponential time to match this title
    it('should not take exponential time for terms that are costly as a pattern', async () => {
        const start = process.hrtime.bigint();
        const html = await renderPageResult('(a+)+b', 'a'.repeat(24));
        const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;

        expect(renderedTitle(html)).toBe('a'.repeat(24));
        expect(elapsedMs).toBeLessThan(200);
    }, 1000);
});
