/** @jest-environment jsdom */
/* global DOMParser, Node, NodeFilter */

'use strict';

// Archive and request values (URLs, timestamps, dates, JSON) are rendered as text:
// HTML-escaped in markup, and as JSON string literals in the replay script.
// Templates are rendered directly with EJS, so no backend is involved; the output
// is parsed with the jsdom DOMParser.

const path = require('node:path');
const vm = require('node:vm');
const ejs = require('ejs');
const timestampToText = require('../utils/timestamp-to-text');
const isValidUrl = require('../utils/is-valid-url');

const VIEWS = path.join(__dirname, '../../views');

const CONFIG = {
    'pywb.url': 'https://replay.example.org/noFrame/replay',
    'screenshot.url': 'https://replay.example.org/screenshot',
    'oldweb.today.fullUrl': 'https://oldweb.example.org/?browser=ff10',
};

const TRANSLATIONS = {
    'common.date.long': '${day} ${month} ${hours}h${minutes}, ${year}',
    'common.date.short': '${day} ${month}',
    'common.months.01': 'Jan',
};

// Characters that must come out as text, plus a comment end.
const SPECIAL = 'https://example.com/a?b="1"&c=<i>\'x\'</i>-->';
const SPECIAL_ESCAPED = ejs.escapeXML(SPECIAL);
// A month name with the same characters, so the dates built from it carry them too.
const SPECIAL_MONTH = 'Jan & <i>"x"</i>-->';

const NORMAL_URL = 'https://example.com/path/page.html?a=1&b=2';
const TIMESTAMP = '20230101120000';
const SPECIAL_TIMESTAMP = `${TIMESTAMP}"<i>&'-->`;

const translate = (month) => (key, vars = {}) =>
    (key === 'common.months.01' ? month : TRANSLATIONS[key] || key)
        .replace(/\$\{(\w+)\}/g, (_, name) => vars[name] ?? '');

const BASE_LOCALS = {
    t: translate(TRANSLATIONS['common.months.01']),
    utils: { timestampToText, isValidUrl },
    config: { get: (key) => CONFIG[key] },
    getLanguage: () => 'en',
};

const render = (template, locals) =>
    ejs.renderFile(path.join(VIEWS, template), { ...BASE_LOCALS, ...locals }, { views: [VIEWS] });

const parse = (html) => new DOMParser().parseFromString(html, 'text/html');

// Elements with their attribute names, and comments, in document order: the same for
// any value when the values are text.
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

// Decoded attribute value and text of the first element matching the selector.
const attr = (html, selector, name) => parse(html).querySelector(selector).getAttribute(name);
const text = (html, selector) => parse(html).querySelector(selector).textContent;

const date = (month) => `1 ${month} 12h00, 2023`;

describe('views render archive and request values as text', () => {
    describe('replay right menu', () => {
        const renderMenu = (url, month = 'Jan') => render('templates/menu/replay_right_nav_menu.ejs', {
            t: translate(month),
            requestedPage: { url, timestamp: TIMESTAMP, fullUrl: `${TIMESTAMP}/${url}` },
        });

        it('should escape the URL and the date in the menu text and links', async () => {
            const html = await renderMenu(SPECIAL, SPECIAL_MONTH);

            expect(html).not.toContain(SPECIAL);
            expect(html).not.toContain(SPECIAL_MONTH);
            expect(html).toContain(`<span id="menuUrl" class="link-line-height">${SPECIAL_ESCAPED}</span>`);
            expect(html).toContain(`<span id="menuTs" class="page-date">${ejs.escapeXML(date(SPECIAL_MONTH))}</span>`);
            expect(text(html, '#menuTs')).toBe(date(SPECIAL_MONTH));
            expect(attr(html, '#menuFullScreen', 'href')).toBe(`${CONFIG['pywb.url']}/${TIMESTAMP}/${SPECIAL}`);
            expect(structure(html)).toEqual(structure(await renderMenu(NORMAL_URL)));
        });

        it('should encode the URL in the list versions link', async () => {
            const href = attr(await renderMenu(SPECIAL), '#menuListVersions', 'href');

            expect(href).toBe(`/page/search?q=${encodeURIComponent(SPECIAL)}`);
            expect(new URL(href, 'https://arquivo.example.org').searchParams.get('q')).toBe(SPECIAL);
        });

        it.each([
            ['&', 'https://example.com/?a=1&b=2'],
            ['#', 'https://example.com/page#part'],
            ['+', 'https://example.com/?q=a+b'],
        ])('should keep the whole URL with %s in the list versions query', async (_, url) => {
            const href = attr(await renderMenu(url), '#menuListVersions', 'href');

            expect(new URL(href, 'https://arquivo.example.org').searchParams.get('q')).toBe(url);
        });
    });

    describe('replay header', () => {
        const renderHeader = (url, month = 'Jan') => render('templates/header/header-replay.ejs', {
            t: translate(month),
            requestedPage: { url, timestamp: TIMESTAMP, fullUrl: `${TIMESTAMP}/${url}` },
            apiData: {},
            requestData: new URLSearchParams({ url, timestamp: TIMESTAMP }),
        });

        it('should escape the URL and the date in the chosen URL link', async () => {
            const html = await renderHeader(SPECIAL, SPECIAL_MONTH);
            const link = html.match(/<p id="chosen-url"[^]*?<\/p>/)[0];

            expect(link).toBe(
                `<p id="chosen-url" class="chosen-url-cl"><a id="chosen-url-a" class="chosen-url-cl" target="_blank" href="${SPECIAL_ESCAPED}">${SPECIAL_ESCAPED}</a> <br> <span id="chosen-url-date">${ejs.escapeXML(date(SPECIAL_MONTH))}</span></p>`
            );
            expect(attr(html, '#chosen-url-a', 'href')).toBe(SPECIAL);
            expect(text(html, '#chosen-url-date')).toBe(date(SPECIAL_MONTH));
            expect(structure(html)).toEqual(structure(await renderHeader(NORMAL_URL)));
        });
    });

    describe('replay body', () => {
        const renderBody = (url, timestamp = TIMESTAMP) => render('templates/body/body-replay.ejs', {
            requestedPage: { url, timestamp, fullUrl: `${timestamp}/${url}` },
        });

        // The script inside the comment, as it would run once the comment is removed.
        const replayConfig = (html) => {
            const script = html.match(/<script>([^]*?)<\/script> -->/)[1];
            let config;
            vm.runInNewContext(script, { ArquivoReplay: function (c) { config = c; } });
            return config;
        };

        it('should keep the values inside their comments', async () => {
            const html = await renderBody(SPECIAL, SPECIAL_TIMESTAMP);

            expect(html).not.toContain(SPECIAL);
            expect(html).not.toContain(SPECIAL_TIMESTAMP);
            expect(structure(html)).toEqual(structure(await renderBody(NORMAL_URL)));
        });

        it('should escape the URL in the iframe address', async () => {
            const html = await renderBody(SPECIAL);

            expect(html).toContain(`src="${CONFIG['pywb.url']}/${TIMESTAMP}/${SPECIAL_ESCAPED}">`);
        });

        it.each([
            ['special characters', SPECIAL, SPECIAL_TIMESTAMP],
            ['a normal URL', NORMAL_URL, TIMESTAMP],
            ['a closing tag', 'https://example.com/</script><b>', TIMESTAMP],
        ])('should read back the same values in the script for %s', async (_, url, timestamp) => {
            const html = await renderBody(url, timestamp);
            const config = replayConfig(html);

            expect(html).not.toContain('<b>');
            expect(config['requestedPage.url']).toBe(url);
            expect(config['requestedPage.fullUrl']).toBe(`${timestamp}/${url}`);
            expect(config['requestedPage.timestamp']).toBe(timestamp);
            expect(config['pywb.url']).toBe(CONFIG['pywb.url']);
        });

        it('should start with the replay content, without blank lines', async () => {
            const html = await renderBody(NORMAL_URL);

            expect(html.startsWith('<!-- starts replay content -->')).toBe(true);
        });
    });

    describe('URL search results', () => {
        const renderResults = (template, url, timestamp = TIMESTAMP) => render(template, {
            apiData: [{ timestamp, url }],
            requestData: new URLSearchParams({ q: url, from: '2023', to: '2023' }),
            suggestion: url,
        });

        it('should escape the URL in the list result link', async () => {
            const html = await renderResults('partials/url-list-results.ejs', SPECIAL);
            const links = html.match(/<a href="\/wayback\/[^"]*">/g);

            expect(links).toEqual([`<a href="/wayback/${TIMESTAMP}/${SPECIAL_ESCAPED}">`]);
            expect(attr(html, '.menu-pages-replay-date-hour a', 'href')).toBe(`/wayback/${TIMESTAMP}/${SPECIAL}`);
            expect(html).not.toContain(SPECIAL);
            expect(structure(html)).toEqual(structure(await renderResults('partials/url-list-results.ejs', NORMAL_URL)));
        });

        it('should escape the URL and the timestamp in the table result cell', async () => {
            const html = await renderResults('partials/url-table-results.ejs', SPECIAL, SPECIAL_TIMESTAMP);
            const cell = html.match(/<td class="year-month-data"[^>]*> <a [^>]*>/g);

            expect(cell).toEqual([
                `<td class="year-month-data" headers="year-2023" id="table-cell-${ejs.escapeXML(SPECIAL_TIMESTAMP)}"> <a href="/wayback/${ejs.escapeXML(SPECIAL_TIMESTAMP)}/${SPECIAL_ESCAPED}" title="${date('Jan')}">`,
            ]);
            expect(attr(html, 'td.year-month-data', 'id')).toBe(`table-cell-${SPECIAL_TIMESTAMP}`);
            expect(attr(html, 'td.year-month-data a', 'href')).toBe(`/wayback/${SPECIAL_TIMESTAMP}/${SPECIAL}`);
            expect(html).not.toContain(SPECIAL);
            expect(html).not.toContain(SPECIAL_TIMESTAMP);
            expect(structure(html)).toEqual(structure(await renderResults('partials/url-table-results.ejs', NORMAL_URL)));
        });
    });

    describe('replay versions menu', () => {
        const renderNav = (url) => render('partials/replay-nav.ejs', {
            apiData: [{ timestamp: TIMESTAMP, url }],
            requestData: new URLSearchParams({ url, timestamp: TIMESTAMP }),
        });

        it('should escape the URL in the version link', async () => {
            const html = await renderNav(SPECIAL);
            const links = html.match(/<li class="menu-pages-replay-date-hour[^"]*"><a [^>]*>/g);

            expect(links).toEqual([
                `<li class="menu-pages-replay-date-hour date-selected"><a href="/wayback/${TIMESTAMP}/${SPECIAL_ESCAPED}" replay-url="${SPECIAL_ESCAPED}" replay-timestamp="${TIMESTAMP}">`,
            ]);
            expect(attr(html, '.date-selected a', 'href')).toBe(`/wayback/${TIMESTAMP}/${SPECIAL}`);
            expect(structure(html)).toEqual(structure(await renderNav(NORMAL_URL)));
        });
    });

    describe('ArchivePageNow recording page', () => {
        const renderSave = (url) => render('pages/services-archivepagenow-save.ejs', {
            url: 'https://save.example.org/services/save/' + url,
            recordingUrl: `https://arquivo.example.org/wayback/${TIMESTAMP}/${url}`,
            liveUrl: url,
            originalUrl: '/services/archivepagenow',
            getLocales: () => ['en'],
        });

        it('should escape the recorder and recording addresses', async () => {
            const html = await renderSave(SPECIAL);

            expect(html).toContain(`src="https://save.example.org/services/save/${SPECIAL_ESCAPED}"`);
            expect(html).toContain(`href="https://arquivo.example.org/wayback/${TIMESTAMP}/${SPECIAL_ESCAPED}"`);
            expect(attr(html, '#replay_iframe', 'src')).toBe(`https://save.example.org/services/save/${SPECIAL}`);
            expect(attr(html, '#recording-url', 'href')).toBe(`https://arquivo.example.org/wayback/${TIMESTAMP}/${SPECIAL}`);
            expect(html).not.toContain(SPECIAL);
            expect(structure(html)).toEqual(structure(await renderSave(NORMAL_URL)));
        });
    });

    describe('search results JSON', () => {
        const DATA = { q: SPECIAL, items: [{ title: 'a & b', url: SPECIAL }] };

        it('should escape the page results export and impact timeline', async () => {
            const html = await render('partials/pages-search-results.ejs', {
                apiData: { estimated_nr_results: 1, response_items: [], timeline: { impact: { 2023: SPECIAL } } },
                requestData: new URLSearchParams({ q: 'x' }),
                suggestion: 'x',
                exportObject: DATA,
            });

            expect(JSON.parse(text(html, '#options-export-json'))).toEqual(DATA);
            expect(JSON.parse(text(html, '#search-impact-timeline-json'))).toEqual({ 2023: SPECIAL });
            expect(html).not.toContain(SPECIAL);
        });

        it('should escape the image results export', async () => {
            const html = await render('partials/images-search-results.ejs', {
                apiData: { responseItems: [], totalItems: 1 },
                requestData: new URLSearchParams({ q: 'x', from: '2023', to: '2023' }),
                suggestion: 'x',
                exportObject: DATA,
            });

            expect(JSON.parse(text(html, '#options-export-json'))).toEqual(DATA);
            expect(html).not.toContain(SPECIAL);
        });
    });
});
