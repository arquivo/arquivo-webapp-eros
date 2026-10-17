/** @jest-environment jsdom */
const { loadScript } = require('./helpers/load-script.cjs');
const { fakeServer, flush } = require('./helpers/fake-server.cjs');

const PYWB_URL = 'https://replay.example.org/noFrame/replay';
const PYWB_ORIGIN = 'https://replay.example.org';

// The replay page parts replay.js updates (views/templates/body/body-replay.ejs and menus).
const PAGE = `
<a id="menuUrl"></a><span id="menuTs"></span><a id="menuFullScreen" href=""></a>
<a id="chosen-url-a" href=""></a><span id="chosen-url-date"></span><a id="menuListVersions" href=""></a>
<nav id="replay-left-nav"><h3>Versions</h3><div class="loader">old nav</div></nav>
<div id="technical-details">old details</div>
<iframe id="replay-in-iframe" src="about:blank"></iframe>
<div id="replay-not-found" style="display:none"></div>`;

// views/partials/replay-nav.ejs and replay-technical-details.ejs, reduced.
const REPLAY_NAV = `
<ul class="accordion-replay-left-menu-year"><li class="menu-pages-replay-date-hour"><a replay-timestamp="20210101000000">2021</a></li>
<li class="menu-pages-replay-date-hour"><a replay-timestamp="20220202000000">2022</a></li></ul>`;
const TECHNICAL_DETAILS = '<div id="technical-details"><p class="new-details">details</p></div>';
const LOADER = '<div class="loader">loading</div>';

const CONFIGS = {
    'language': 'en',
    'pywb.url': PYWB_URL,
    'requestedPage.fullUrl': '20200101000000/https://example.com/',
    'requestedPage.url': 'https://example.com/',
    'requestedPage.timestamp': '20200101000000',
    'preservedByArquivo': 'preserved by Arquivo.pt',
    'loader.html': LOADER,
};

const $id = (id) => document.getElementById(id);

function post(data, origin = PYWB_ORIGIN) {
    window.dispatchEvent(new MessageEvent('message', { data, origin }));
}

describe('replay.js', () => {
    let $;
    let server;
    let listeners;
    let ArquivoReplay;

    beforeAll(async () => {
        loadScript('vendor/js/jquery-1.12.4.js');
        $ = window.jQuery;
        await new Promise((resolve) => $(resolve));
        ({ ArquivoReplay } = loadScript('js/replay.js', { globals: ['ArquivoReplay'] }));
    });

    beforeEach(() => {
        // Globals from functions.js and the jQuery plugins the page loads.
        window.dateFromTimestamp = (ts) => 'date(' + ts + ')';
        $.modal = { close: jest.fn() };
        $.fn.scrollParent = jest.fn(function () { return $(document.body); });
        jest.spyOn(window.history, 'pushState').mockImplementation(() => {});
        document.title = 'Arquivo.pt';
        document.body.innerHTML = PAGE;
        server = fakeServer();
        listeners = [];
        const add = window.addEventListener;
        jest.spyOn(window, 'addEventListener').mockImplementation(function (...args) {
            listeners.push(args);
            return add.apply(this, args);
        });
    });

    afterEach(() => {
        listeners.forEach((args) => window.removeEventListener(...args));
        jest.restoreAllMocks();
        $(document).off();
        server.restore();
        document.body.innerHTML = '';
        delete window.dataLayer;
        delete window.dateFromTimestamp;
        window.onpopstate = null;
    });

    const newReplay = () => new ArquivoReplay({ ...CONFIGS });
    const urls = () => server.requests.map((r) => [r.method, r.url]);

    describe('loading the navigation and technical details', () => {
        it('loads both for a new URL and shows them', async () => {
            server.respond('/partials/replay-nav', { body: REPLAY_NAV });
            server.respond('/partials/replay-technical-details', { body: TECHNICAL_DETAILS });
            const replay = newReplay();

            replay.setUrlAndTimestamp('https://example.org/a?b=c', '20210101000000');

            expect($id('replay-left-nav').innerHTML).toBe('<h3>Versions</h3>' + LOADER);
            expect($id('technical-details').innerHTML).toBe(LOADER);
            await flush();

            expect(urls()).toEqual([
                ['GET', '/partials/replay-nav?url=https%3A%2F%2Fexample.org%2Fa%3Fb%3Dc&timestamp=20210101000000'],
                ['GET', '/partials/replay-technical-details?url=https%3A%2F%2Fexample.org%2Fa%3Fb%3Dc&timestamp=20210101000000'],
            ]);
            expect($id('replay-left-nav').querySelector('h3').textContent).toBe('Versions');
            expect($id('replay-left-nav').querySelector('.date-selected a').getAttribute('replay-timestamp')).toBe('20210101000000');
            expect(document.querySelector('.new-details')).not.toBeNull();
            expect(document.querySelectorAll('#technical-details')).toHaveLength(1);
        });

        it('loads only the technical details for a new timestamp of the same URL', async () => {
            server.respond('/partials/replay-technical-details', { body: TECHNICAL_DETAILS });
            const replay = newReplay();

            replay.setUrlAndTimestamp('https://example.com/', '20220202000000');
            await flush();

            expect(urls()).toEqual([
                ['GET', '/partials/replay-technical-details?url=https%3A%2F%2Fexample.com%2F&timestamp=20220202000000'],
            ]);
            expect(document.querySelector('.new-details')).not.toBeNull();
        });

        it('drops a reply that arrives after the user moved on', async () => {
            server.respond('/partials/replay-nav', { body: REPLAY_NAV });
            server.respond('/partials/replay-technical-details', { body: TECHNICAL_DETAILS });
            const replay = newReplay();

            replay.setUrlAndTimestamp('https://example.org/', '20210101000000');
            replay.setConfig('requestedPage.fullUrl', '20230303000000/https://example.net/');
            await flush();

            expect($id('replay-left-nav').innerHTML).toBe('<h3>Versions</h3>' + LOADER);
            expect(document.querySelector('.new-details')).toBeNull();
        });

        it.each([
            ['an HTTP error', { status: 500, body: '<h1>Server error</h1>' }],
            ['a network error', { networkError: true }],
        ])('keeps the loaders on %s', async (_case, response) => {
            server.respond('/partials/', response);
            const replay = newReplay();

            replay.setUrlAndTimestamp('https://example.org/', '20210101000000');
            await flush();

            expect($id('replay-left-nav').innerHTML).toBe('<h3>Versions</h3>' + LOADER);
            expect($id('technical-details').innerHTML).toBe(LOADER);
        });
    });

    describe('messages from the replay', () => {
        it('follows a page loaded in the replay', async () => {
            const replay = newReplay();
            const setUrlAndTimestamp = jest.spyOn(replay, 'setUrlAndTimestamp');

            post({ wb_type: 'load', url: 'https://example.org/', ts: '20210101000000', title: 'Example' });

            expect(setUrlAndTimestamp).toHaveBeenCalledWith('https://example.org/', '20210101000000', false);
            expect(document.title).toBe('Example - preserved by Arquivo.pt');
            expect(window.dataLayer).toEqual([{ event: 'replay_page_view', event_label: 'https://example.org/' }]);
        });

        it('adds a history entry when the replay changes the URL', () => {
            const replay = newReplay();
            const setUrlAndTimestamp = jest.spyOn(replay, 'setUrlAndTimestamp');

            post({ wb_type: 'replace-url', url: 'http://example.org/b', ts: '20210101000000' });

            expect(setUrlAndTimestamp).toHaveBeenCalledWith('http://example.org/b', '20210101000000', true);
        });

        it('shows the not found section', () => {
            newReplay();

            post({ wb_type: 'not-found' });

            expect($id('replay-in-iframe').style.display).toBe('none');
            expect($id('replay-not-found').style.display).not.toBe('none');
        });

        it('scrolls the selected date into view when the section loads (init.js)', () => {
            newReplay();
            document.getElementById('replay-left-nav').innerHTML = '<ul><li class="date-selected"><a>d</a></li></ul>';

            post({ arquivo_type: 'section-loaded', message: 'date' }, window.location.origin);

            expect($.fn.scrollParent).toHaveBeenCalledTimes(1);
        });

        it.each([
            ['another origin', 'https://evil.example.net'],
            ['the page itself', 'http://localhost'],
            ['an opaque origin (sandboxed frame)', 'null'],
            ['no origin', ''],
            ['the pywb host on another port', PYWB_ORIGIN + ':8443'],
            ['a host that ends with the pywb host', 'https://evil-replay.example.org'],
            ['a host that starts with the pywb host', PYWB_ORIGIN + '.evil.example'],
        ])('ignores replay messages from %s', (_case, origin) => {
            const replay = newReplay();
            const setUrlAndTimestamp = jest.spyOn(replay, 'setUrlAndTimestamp');

            post({ wb_type: 'load', url: 'https://example.org/', ts: '20210101000000', title: 'Evil' }, origin);
            post({ wb_type: 'not-found' }, origin);

            expect(setUrlAndTimestamp).not.toHaveBeenCalled();
            expect(document.title).toBe('Arquivo.pt');
            expect(window.dataLayer).toBeUndefined();
            expect($id('replay-not-found').style.display).toBe('none');
        });

        it('ignores section-loaded messages from the replay', () => {
            newReplay();
            document.getElementById('replay-left-nav').innerHTML = '<ul><li class="date-selected"><a>d</a></li></ul>';

            post({ arquivo_type: 'section-loaded', message: 'date' }, PYWB_ORIGIN);
            post({ arquivo_type: 'section-loaded', message: 'date' }, 'https://evil.example.net');

            expect($.fn.scrollParent).not.toHaveBeenCalled();
        });

        it('accepts no replay messages when pywb.url is not an http(s) URL', () => {
            const replay = new ArquivoReplay({ ...CONFIGS, 'pywb.url': 'javascript:alert(1)' });
            const setUrlAndTimestamp = jest.spyOn(replay, 'setUrlAndTimestamp');

            post({ wb_type: 'load', url: 'https://example.org/', ts: '20210101000000' }, 'null');

            expect(setUrlAndTimestamp).not.toHaveBeenCalled();
        });

        it.each([
            ['missing', undefined],
            ['relative', '/noFrame/replay'],
        ])('accepts no replay messages, not even from the page itself, when pywb.url is %s', (_case, pywbUrl) => {
            const replay = new ArquivoReplay({ ...CONFIGS, 'pywb.url': pywbUrl });
            const setUrlAndTimestamp = jest.spyOn(replay, 'setUrlAndTimestamp');

            post({ wb_type: 'load', url: 'https://example.org/', ts: '20210101000000', title: 'Evil' }, window.location.origin);

            expect(setUrlAndTimestamp).not.toHaveBeenCalled();
            expect(document.title).toBe('Arquivo.pt');
        });

        it.each([
            ['a javascript: URL', 'javascript:alert(1)'],
            ['a javascript: URL after a control character', '\x01javascript:alert(1)'],
            ['a javascript: URL with a tab in the scheme', 'java\tscript:alert(1)'],
            ['a data: URL', 'data:text/html,hi'],
            ['a URL without a scheme', 'example.org/a'],
            ['no URL', undefined],
            ['a non-string URL', { toString: () => 'https://example.org/' }],
        ])('does not follow %s from the replay', (_case, url) => {
            const replay = newReplay();
            const setUrlAndTimestamp = jest.spyOn(replay, 'setUrlAndTimestamp');

            post({ wb_type: 'replace-url', url, ts: '20210101000000' });

            expect(setUrlAndTimestamp).not.toHaveBeenCalled();
            expect(window.dataLayer).toBeUndefined();
            expect(window.history.pushState).not.toHaveBeenCalled();
        });

        it('still sets the title of a loaded page whose URL it does not follow', () => {
            newReplay();

            post({ wb_type: 'load', url: 'javascript:alert(1)', title: 'Example' });

            expect(document.title).toBe('Example - preserved by Arquivo.pt');
        });
    });
});
