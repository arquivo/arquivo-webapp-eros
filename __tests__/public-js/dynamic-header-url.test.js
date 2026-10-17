/** @jest-environment jsdom */
const { describeScript } = require('./helpers/load-script.cjs');

// The toolbar from views/pages/services-complete-page.ejs.
const COMPLETE_PAGE_HEADER = `
<div id="headerUrlContainer">
  <a id="headerUrl" class="headerUrl" target="_blank" href="https://start.pt/" title="https://start.pt/">https://start.pt/</a>
  <span id="headerTimestamp" class="headerTimestamp">1 janeiro 00h00, 2000</span>
</div>`;

// The toolbar from views/pages/services-archivepagenow-save.ejs (no timestamp).
const ARCHIVEPAGENOW_HEADER = `
<a id="headerUrl" class="headerUrl" target="_blank" href="https://start.pt/" title="https://start.pt/">https://start.pt/</a>`;

const $id = (id) => document.getElementById(id);

// pywb posts these from the replay iframe.
function postFromReplay(data) {
    window.dispatchEvent(new MessageEvent('message', { data }));
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
        ['www.example.com/a/b', 'example.com/a/b'],
        ['https://sub.www.example.com/?q=<b>', 'sub.www.example.com/?q=<b>'],
        ['ftp://www.example.com/', 'ftp://www.example.com'],
    ])('shows %s as %s', (url, shown) => {
        setup();

        postFromReplay({ wb_type: 'load', url });

        expect($id('headerUrl').textContent).toBe(shown);
        expect($id('headerUrl').children).toHaveLength(0);
        expect($id('headerUrl').getAttribute('href')).toBe(url);
    });

    it.each(['load', 'title'])('logs a "%s" message from the replay', (wbType) => {
        setup();
        const data = { wb_type: wbType, url: 'https://example.com/' };

        postFromReplay(data);

        expect(console.log).toHaveBeenCalledTimes(1);
        expect(console.log).toHaveBeenCalledWith(data);
    });

    it('does not log messages that are not from the replay', () => {
        setup();

        postFromReplay({ url: 'https://example.com/' });
        postFromReplay({ wb_type: 'load' });

        expect(console.log).not.toHaveBeenCalled();
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
        setup('<span id="headerTimestamp"></span>');

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
