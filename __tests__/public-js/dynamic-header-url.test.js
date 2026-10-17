/** @jest-environment jsdom */
const { describeScript } = require('./helpers/load-script.cjs');

// The backend the replay iframe loads from (patching.url, services.archivepagenow.url).
const REPLAY_ORIGIN = 'https://backend.example.org';

// The replay iframe of both pages.
const REPLAY_IFRAME = `
<iframe name="replay_iframe" id="replay_iframe" src="${REPLAY_ORIGIN}/noFrame/patching/record/20000101000000/https://start.pt/"></iframe>`;

// The toolbar and iframe from views/pages/services-complete-page.ejs.
const COMPLETE_PAGE_HEADER = `
<div id="headerUrlContainer">
  <a id="headerUrl" class="headerUrl" target="_blank" href="https://start.pt/" title="https://start.pt/">https://start.pt/</a>
  <span id="headerTimestamp" class="headerTimestamp">1 janeiro 00h00, 2000</span>
</div>${REPLAY_IFRAME}`;

// The toolbar and iframe from views/pages/services-archivepagenow-save.ejs (no timestamp).
const ARCHIVEPAGENOW_HEADER = `
<a id="headerUrl" class="headerUrl" target="_blank" href="https://start.pt/" title="https://start.pt/">https://start.pt/</a>${REPLAY_IFRAME}`;

const $id = (id) => document.getElementById(id);

// pywb posts these from the replay iframe.
function postFromReplay(data, origin = REPLAY_ORIGIN) {
    window.dispatchEvent(new MessageEvent('message', { data, origin }));
}

describeScript('js/dynamic-header-url.js', { html: COMPLETE_PAGE_HEADER }, ({ setup }) => {
    beforeEach(() => {
        // Defined globally by functions.js on the real pages.
        window.dateFromTimestamp = jest.fn((ts, format) => `date(${ts},${format})`);
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
        delete window.dateFromTimestamp;
    });

    it.each(['load', 'replace-url', 'unload'])('a "%s" message shows the replayed URL and date', (wbType) => {
        setup();

        postFromReplay({ wb_type: wbType, url: 'https://www.example.com/path/', ts: '20200102030405' });

        const headerUrl = $id('headerUrl');
        expect(headerUrl.textContent).toBe('example.com/path');
        expect(headerUrl.getAttribute('href')).toBe('https://www.example.com/path/');
        expect(headerUrl.getAttribute('title')).toBe('https://www.example.com/path/');
        expect(window.dateFromTimestamp).toHaveBeenCalledTimes(1);
        expect(window.dateFromTimestamp).toHaveBeenCalledWith('20200102030405', 'long');
        expect($id('headerTimestamp').textContent).toBe('date(20200102030405,long)');
    });

    it.each([
        ['http://example.com', 'example.com'],
        ['HTTPS://www.example.com/a/b', 'HTTPS://www.example.com/a/b'],
        ['https://sub.www.example.com/?q=<b>', 'sub.www.example.com/?q=<b>'],
    ])('shows %s as %s', (url, shown) => {
        setup();

        postFromReplay({ wb_type: 'load', url });

        expect($id('headerUrl').textContent).toBe(shown);
        expect($id('headerUrl').children).toHaveLength(0);
        expect($id('headerUrl').getAttribute('href')).toBe(url);
    });

    it('does not log the messages', () => {
        setup();

        postFromReplay({ wb_type: 'load', url: 'https://example.com/' });

        expect(console.log).not.toHaveBeenCalled();
        expect($id('headerUrl').textContent).toBe('example.com');
    });

    it.each([
        ['another origin', 'https://evil.example.net'],
        ['the page itself', 'http://localhost'],
        ['an opaque origin (sandboxed frame)', 'null'],
        ['no origin', ''],
        ['the replay origin on another port', REPLAY_ORIGIN + ':8443'],
        ['the replay host over http', REPLAY_ORIGIN.replace('https:', 'http:')],
        ['a host that ends with the replay host', 'https://evil-backend.example.org'],
        ['a host that starts with the replay host', REPLAY_ORIGIN + '.evil.example'],
    ])('ignores messages from %s', (_case, origin) => {
        setup();
        const before = document.body.innerHTML;

        postFromReplay({ wb_type: 'load', url: 'https://example.com/', ts: '20200102030405' }, origin);

        expect(document.body.innerHTML).toBe(before);
        expect(window.dateFromTimestamp).not.toHaveBeenCalled();
    });

    it.each([
        ['an about:blank iframe', '<a id="headerUrl" href="https://start.pt/">x</a><iframe id="replay_iframe" src="about:blank"></iframe>', 'null'],
        ['no replay iframe', '<a id="headerUrl" href="https://start.pt/">x</a>', 'http://localhost'],
    ])('ignores every message on a page with %s', (_case, html, origin) => {
        setup(html);
        const before = document.body.innerHTML;

        postFromReplay({ wb_type: 'load', url: 'https://example.com/' }, origin);

        expect(document.body.innerHTML).toBe(before);
    });

    it.each([
        ['a javascript: URL', 'javascript:alert(1)'],
        ['a JavaScript: URL with odd case and spaces', ' JavaScript:alert(1)'],
        ['a javascript: URL after a control character', '\x01javascript:alert(1)'],
        ['a javascript: URL with a tab in the scheme', 'java\tscript:alert(1)'],
        ['a data: URL', 'data:text/html,hi'],
        ['an ftp: URL', 'ftp://www.example.com/'],
        ['a URL without a scheme', 'www.example.com/a/b'],
        ['a non-string URL', { toString: () => 'https://example.com/' }],
    ])('rejects %s from the replay', (_case, url) => {
        setup();
        const before = document.body.innerHTML;

        postFromReplay({ wb_type: 'load', url, ts: '20200102030405' });

        expect(document.body.innerHTML).toBe(before);
        expect($id('headerUrl').getAttribute('href')).toBe('https://start.pt/');
        expect(window.dateFromTimestamp).not.toHaveBeenCalled();
    });

    it('keeps the date when the message has no timestamp', () => {
        setup();

        postFromReplay({ wb_type: 'replace-url', url: 'https://example.com/' });

        expect($id('headerUrl').textContent).toBe('example.com');
        expect(window.dateFromTimestamp).not.toHaveBeenCalled();
        expect($id('headerTimestamp').textContent).toBe('1 janeiro 00h00, 2000');
    });

    it('updates only the URL on pages without a date (archivepagenow)', () => {
        setup(ARCHIVEPAGENOW_HEADER);

        postFromReplay({ wb_type: 'load', url: 'https://example.com/', ts: '20200102030405' });

        expect($id('headerUrl').textContent).toBe('example.com');
        expect(window.dateFromTimestamp).not.toHaveBeenCalled();
    });

    it('still updates the date on a page without the URL link', () => {
        setup('<span id="headerTimestamp"></span>' + REPLAY_IFRAME);

        postFromReplay({ wb_type: 'load', url: 'https://example.com/', ts: '20200102030405' });

        expect($id('headerTimestamp').textContent).toBe('date(20200102030405,long)');
    });

    it.each([
        ['another wb_type', { wb_type: 'title', url: 'https://example.com/', ts: '20200102030405' }],
        ['no wb_type', { url: 'https://example.com/', ts: '20200102030405' }],
        ['no url', { wb_type: 'load', ts: '20200102030405' }],
        ['a string', 'https://example.com/'],
        ['no data', null],
    ])('ignores messages with %s', (_case, data) => {
        setup();
        const before = document.body.innerHTML;

        postFromReplay(data);

        expect(document.body.innerHTML).toBe(before);
        expect(window.dateFromTimestamp).not.toHaveBeenCalled();
    });

    it('reads an event "message" property in place of "data" (legacy attachEvent)', () => {
        setup();
        const event = new Event('message');
        event.message = { wb_type: 'load', url: 'https://example.com/legacy' };
        event.origin = REPLAY_ORIGIN;

        window.dispatchEvent(event);

        expect($id('headerUrl').textContent).toBe('example.com/legacy');
    });

    it('listens from the moment it loads, before the page has been parsed', () => {
        setup('');
        document.body.innerHTML = COMPLETE_PAGE_HEADER;

        postFromReplay({ wb_type: 'load', url: 'https://example.com/' });

        expect($id('headerUrl').textContent).toBe('example.com');
    });
});
