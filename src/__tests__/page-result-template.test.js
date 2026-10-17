/** @jest-environment jsdom */
/* global DOMParser, Node, NodeFilter */

'use strict';

const path = require('node:path');
const ejs = require('ejs');
const { asciiHost, displayUrl } = require('../utils/display-url');
const { emphasizedHtml, snippetHtml } = require('../utils/result-html');

const TEMPLATE = path.join(__dirname, '../../views/templates/fragments/page-result.ejs');

const renderPageResult = (query, title, originalURL = 'http://example.com/', more = {}) => ejs.renderFile(TEMPLATE, {
    pageData: {
        originalURL,
        title,
        tstamp: '20230101120000',
        mimeType: 'text/html',
        snippet: '',
        ...more,
    },
    requestData: new URLSearchParams({ q: query }),
    prevUrl: null,
    index: 0,
    t: (key) => key,
    utils: { asciiHost, displayUrl, emphasizedHtml, snippetHtml },
}, { views: [path.join(__dirname, '../../views')] });

const renderedTitle = (html) => html.match(/<a class="results-title blockUrl">(.*)<\/a>/)[1];
const renderedUrl = (html) => html.match(/<li><a class="results-url blockUrl" (.*)<\/li>/)[1];
const renderedSnippet = (html) => html.match(/<p class="results-summary blockUrl">(.*)<\/p>/)[1];

const parse = (html) => new DOMParser().parseFromString(html, 'text/html');

// Elements with their attribute names, and comments, in document order: the same for
// any title and snippet when they are shown as text.
const structure = (html) => {
    const doc = parse(html);
    const walker = doc.createTreeWalker(doc, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT);
    const nodes = [];
    while (walker.nextNode()) {
        const node = walker.currentNode;
        nodes.push(node.nodeType === Node.COMMENT_NODE
            ? '#comment'
            : [node.localName, ...node.getAttributeNames()].join(' '));
    }
    return nodes;
};

const text = (html, selector) => parse(html).querySelector(selector).textContent;

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

        expect(renderedUrl(html)).toBe('title="www.publico.pt">www.publico.pt</a>');
    });

    it('should show the ASCII host of an internationalised host under the address and in its title', async () => {
        // `а` is CYRILLIC SMALL LETTER A (U+0430), not the Latin `a`.
        const html = await renderPageResult('paypal', 'PayPal', 'http://pаypal.com/login');

        expect(renderedUrl(html)).toBe(
            'title="\u2068pаypal.com/login\u2069 (xn--pypal-4ve.com)">pаypal.com/login</a>'
            + '<span class="url-ascii-host" dir="ltr" translate="no">(xn--pypal-4ve.com)</span>');
    });
});

// Characters that must come out as text, plus a comment end and closing tags.
const SPECIAL = `a "b" <i>c</i> 'd' & e --> </p></a></li></ul>`;

describe('page result template: title and snippet shown as text', () => {
    const renderSpecial = () => renderPageResult('lisboa', SPECIAL, 'http://example.com/', { snippet: SPECIAL });
    const renderNormal = () => renderPageResult('lisboa', 'Viver bem', 'http://example.com/', { snippet: 'Um texto' });

    it('should escape the title', async () => {
        const html = await renderSpecial();

        expect(renderedTitle(html)).toBe(
            'a &#34;b&#34; &lt;i&gt;c&lt;/i&gt; &#39;d&#39; &amp; e --&gt; &lt;/p&gt;&lt;/a&gt;&lt;/li&gt;&lt;/ul&gt;');
        expect(text(html, '.results-title')).toBe(SPECIAL);
    });

    it('should escape the snippet, keeping its &', async () => {
        const html = await renderSpecial();

        expect(renderedSnippet(html)).toBe(
            'a &#34;b&#34; &lt;i&gt;c&lt;/i&gt; &#39;d&#39; & e --&gt; &lt;/p&gt;&lt;/a&gt;&lt;/li&gt;&lt;/ul&gt;');
        expect(text(html, '.results-summary')).toBe(SPECIAL);
    });

    it('should keep the structure of a normal result', async () => {
        expect(structure(await renderSpecial())).toEqual(structure(await renderNormal()));
    });

    it('should keep the emphasis of the title, with the title escaped around it', async () => {
        const html = await renderPageResult('porto lisboa', '<a> lisboa & porto');

        expect(renderedTitle(html)).toBe('&lt;a&gt; <em>lisboa</em> &amp; <em>porto</em>');
    });

    it.each([
        ['at&t', 'Notícias da AT&T', 'Notícias da <em>AT&amp;T</em>'],
        ['a<b', 'se a<b então', 'se <em>a&lt;b</em> então'],
        ['b>a', 'se b>a então', 'se <em>b&gt;a</em> então'],
        ["d'água", "Copo d'água", 'Copo <em>d&#39;água</em>'],
        [String.raw`a\"b`, 'x a"b y', 'x <em>a&#34;b</em> y'],
    ])('should emphasize the term %s as typed in the title', async (query, title, expected) => {
        const html = await renderPageResult(query, title);

        expect(renderedTitle(html)).toBe(expected);
    });

    it('should emphasize a term followed by > in the title', async () => {
        const html = await renderPageResult('lisboa', 'Lisboa>Porto');

        expect(renderedTitle(html)).toBe('<em>Lisboa</em>&gt;Porto');
    });

    it('should emphasize a term with accents in another case, keeping the case of the title', async () => {
        const html = await renderPageResult('ação', 'AÇÃO e Ação');

        expect(renderedTitle(html)).toBe('<em>AÇÃO</em> e Ação');
    });

    // ẞ lower cases to ß, which the search terms matched in lower case always found.
    it('should emphasize a term in another case where the cases are different letters', async () => {
        const html = await renderPageResult('straße', 'Rua STRAẞE');

        expect(renderedTitle(html)).toBe('Rua <em>STRAẞE</em>');
    });

    // Lower casing İ gives two characters, so positions in the lower cased title are not
    // positions in the title.
    it('should emphasize the term itself after a character that changes length in lower case', async () => {
        const html = await renderPageResult('lisboa', 'İstanbul Lisboa');

        expect(renderedTitle(html)).toBe('İstanbul <em>Lisboa</em>');
    });

    it('should not split a character made of two code units', async () => {
        const html = await renderPageResult('a', 'İa😀');

        expect(renderedTitle(html)).toBe('İ<em>a</em>😀');
        expect(text(html, '.results-title')).toBe('İa😀');
        expect(text(html, '.results-title')).not.toContain('\uFFFD');
    });

    it('should show a title that is not a string', async () => {
        const html = await renderPageResult('2005', 2005);

        expect(renderedTitle(html)).toBe('<em>2005</em>');
    });

    it('should not take the em of the emphasis for a search term', async () => {
        const html = await renderPageResult('lisboa em', 'Viver em Lisboa');

        expect(renderedTitle(html)).toBe('Viver <em>em</em> <em>Lisboa</em>');
    });

    // Titles are plain text (the indexer decodes the entities of the page title), so an
    // entity in a title is shown as typed.
    it('should show an entity in the title as typed', async () => {
        const html = await renderPageResult('lisboa', 'Lisboa &amp; Porto');

        expect(renderedTitle(html)).toBe('<em>Lisboa</em> &amp;amp; Porto');
        expect(text(html, '.results-title')).toBe('Lisboa &amp; Porto');
    });

    it('should show the format of a result that is not text', async () => {
        const html = await renderPageResult('lisboa', 'Lisboa', 'http://example.com/', { mimeType: 'application/pdf' });

        expect(renderedTitle(html)).toBe('<span class="mime">[PDF]</span><em>Lisboa</em>');
    });

    it('should show a format without a subtype', async () => {
        const html = await renderPageResult('lisboa', 'Lisboa', 'http://example.com/', { mimeType: 'pdf' });

        expect(renderedTitle(html)).toBe('<span class="mime">[PDF]</span><em>Lisboa</em>');
    });

    it('should show no format for an empty type', async () => {
        const html = await renderPageResult('lisboa', 'Lisboa', 'http://example.com/', { mimeType: '' });

        expect(renderedTitle(html)).toBe('<em>Lisboa</em>');
    });

    it('should escape the format of a result', async () => {
        const mimeType = `application/x"<b>'&-->`;
        const html = await renderPageResult('lisboa', 'Lisboa', 'http://example.com/', { mimeType });

        expect(renderedTitle(html)).toBe('<span class="mime">[X&#34;&lt;B&gt;&#39;&amp;--&gt;]</span><em>Lisboa</em>');
        expect(structure(html)).toEqual(structure(
            await renderPageResult('lisboa', 'Lisboa', 'http://example.com/', { mimeType: 'application/pdf' })));
    });
});

describe('page result template: snippet markup', () => {
    const renderSnippet = (snippet) => renderPageResult('lisboa', 'Lisboa', 'http://example.com/', { snippet });

    it('should keep the emphasis of the search terms and an existing entity', async () => {
        const html = await renderSnippet('<em>Lisboa</em> e Porto &amp; <em>Faro</em>');

        expect(renderedSnippet(html)).toBe('<em>Lisboa</em> e Porto &amp; <em>Faro</em>');
        expect(text(html, '.results-summary')).toBe('Lisboa e Porto & Faro');
    });

    it('should keep the ellipsis between fragments', async () => {
        const snippet = 'em <em>Lisboa</em> hoje<span class="ellipsis"> ... </span>';
        const html = await renderSnippet(snippet);

        expect(renderedSnippet(html)).toBe(snippet);
    });

    it.each([
        ['<b>Porto</b>', '&lt;b&gt;Porto&lt;/b&gt;'],
        ['<EM>Porto</EM>', '&lt;EM&gt;Porto&lt;/EM&gt;'],
        ['<em class="x">Porto</em>', '&lt;em class=&#34;x&#34;&gt;Porto&lt;/em&gt;'],
        ['<span class="other"> ... </span>', '&lt;span class=&#34;other&#34;&gt; ... &lt;/span&gt;'],
    ])('should show other markup as text: %s', async (snippet, expected) => {
        expect(renderedSnippet(await renderSnippet(snippet))).toBe(expected);
    });

    it.each([
        ['a closing tag with none open', 'a</em> <em>b</em> c', 'a&lt;/em&gt; <em>b</em> c'],
        ['an opening tag inside another', '<em>a<em>b</em>c</em>', '<em>a&lt;em&gt;b</em>c&lt;/em&gt;'],
        ['an opening tag never closed', 'a <em>b', 'a <em>b</em>'],
    ])('should keep the emphasis balanced with %s', async (_, snippet, expected) => {
        const html = await renderSnippet(snippet);

        expect(renderedSnippet(html)).toBe(expected);
        expect(structure(html)).toEqual(structure(await renderSnippet('a <em>b</em> c')));
    });

    it('should keep an & right before the emphasis', async () => {
        const html = await renderSnippet('a &<em>b</em>');

        expect(renderedSnippet(html)).toBe('a &<em>b</em>');
        expect(text(html, '.results-summary')).toBe('a &b');
        expect(structure(html)).toEqual(structure(await renderSnippet('a <em>b</em> c')));
    });

    it('should close an emphasis left open before an ellipsis', async () => {
        const html = await renderSnippet('<em>a<span class="ellipsis"> ... </span>');

        expect(renderedSnippet(html)).toBe('<em>a<span class="ellipsis"> ... </span></em>');
        const ellipsis = parse(html).querySelector('.results-summary > em > span.ellipsis');
        expect(ellipsis.textContent).toBe(' ... ');
        expect(structure(html)).toEqual(structure(await renderSnippet('<em>a</em><span class="ellipsis"> ... </span>')));
    });

    it('should show nothing for a result without a snippet', async () => {
        const html = await renderSnippet(undefined);

        expect(renderedSnippet(html)).toBe('');
    });
});
