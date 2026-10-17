/** @jest-environment jsdom */
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const { describeScript, loadScript } = require('./helpers/load-script.cjs');

const ROOT = path.resolve(__dirname, '..', '..');

// The elements functions.js styles, as the views render them. Some start with an inline
// style, to check that it is replaced and not merged. There are two .blocker-menus
// overlays, to check that every one is styled, as jQuery did.
const PAGE = `
<nav id="left-nav" style="left: -200px; color: red"></nav>
<nav id="options-right-nav" style="right: -250px; color: red"></nav>
<nav id="replay-left-nav" style="color: red"></nav>
<nav id="replay-right-nav" style="color: red"></nav>
<div id="menus-overlay" class="jquery-modal blocker blocker-menus current" style="color: red"></div>
<div class="blocker-menus"></div>
<section id="alert-container" style="color: red"></section>
<iframe id="replay-in-iframe" style="color: red"></iframe>
<section id="fullscreen-mode" class="modal" style="color: red"></section>
<table id="replay-menu-table" style="color: red"></table>
<div id="replay-menu-list" style="color: red"></div>
<input id="submit-search-input" type="search" style="color: red">
<section id="modal-window-image-technical-details" style="color: red"></section>
<a id="close-modal-tecnhical" style="color: red"></a>
<div id="accordion" style="display: none"></div>
<a id="closeAdvancedSearch" style="display: none"></a>`;

// The inline style each function sets, copied from the jQuery `.attr('style', …)` calls
// that functions.js had.
const BLOCKER_OPEN = 'display:block;position: fixed; z-index:1;transition:0.5s';
const BLOCKER_CLOSED = 'display:none;position: fixed; z-index:1;transition:0.5s';
const FULLSCREEN_IFRAME = 'padding: 0;margin:0;width: 100%;position: absolute;z-index: 1;top:0;left:0;height: 100%;0.5s';
const FULLSCREEN_BAR = 'display: inline-block; position: absolute; z-index: 2; top: 0; right: 12px; height: 50px; width: 162px; background-color: transparent; box-shadow: none !important; 0.5s';
const STYLE_CASES = [
    ['openLeftMenuNav', { '#left-nav': 'left:0px;', '.blocker-menus': BLOCKER_OPEN }],
    ['closeLeftMenuNav', { '#left-nav': 'left:-200px', '.blocker-menus': BLOCKER_CLOSED }],
    ['openOptionstMenuNav', { '#options-right-nav': 'right:0px;', '.blocker-menus': BLOCKER_OPEN }],
    ['closeOptionsMenuNav', { '#options-right-nav': 'right:-250px', '.blocker-menus': BLOCKER_CLOSED }],
    ['openReplayLeftMenuNav', { '#replay-left-nav': 'left:0px;transition:0.5s' }],
    ['closeReplayLeftMenuNav', { '#replay-left-nav': 'left:-200px;transition:0.5s' }],
    ['openReplayRightMenuNav', {
        '#replay-right-nav': 'right:0px;',
        '.blocker-menus': 'display:block;position: fixed; z-index:2;transition:0.5s ',
    }],
    ['closeReplayRightMenuNav', { '#replay-right-nav': 'right:-250px', '.blocker-menus': BLOCKER_CLOSED }],
    ['alertsMessageIn', { '#alert-container': 'top:0;height:49px;opacity:1;transition:0.3s;z-index:3' }],
    ['alertsMessageOut', { '#alert-container': 'height:0px;opacity:0;transition:0.5s' }],
    ['opensFullScreen', { '#replay-in-iframe': FULLSCREEN_IFRAME, '#fullscreen-mode': FULLSCREEN_BAR }],
    ['closesFullScreen', {
        '#replay-in-iframe': 'padding: 0; margin: 101px 0 0 0; max-width: 100%;  width: inherit; 0.5s',
        '#fullscreen-mode': 'display: none; transition: 0.5s',
    }],
    ['removeSearchBoxShadow', {
        '#submit-search-input': '-webkit-box-shadow: 0px 0px 0px 0px rgba(255 255 0 / 0%);box-shadow: 0px 0px 0px 0px rgba(255 255 0 / 0%);',
    }],
    ['showsSearchBoxShadow', {
        '#submit-search-input': '-webkit-box-shadow: 0px 4px 5px -2px rgba(0 0 0 / 25%);box-shadow: 0px 4px 5px -2px rgba(0 0 0 / 25%);',
    }],
    ['openImageDetailsModalWindow', {
        '#modal-window-image-technical-details': 'display: block;transition:0.5s',
        '#close-modal-tecnhical': 'display:block; transition:0.5s',
    }],
    ['closeImageDetailsModalWindow', {
        '#modal-window-image-technical-details': 'display:none; transition:0.5s',
        '#close-modal-tecnhical': 'display:none; transition:0.5s',
    }],
];

// The inline style an element gets from `setAttribute('style', css)`, which is what
// jQuery's `.attr('style', css)` does. Compared after parsing, as the browser applies it.
function parsedStyle(css) {
    const element = document.createElement('div');
    element.setAttribute('style', css);
    return element.style.cssText;
}

function expectStyles(styles) {
    Object.entries(styles).forEach(([selector, css]) => {
        const elements = document.querySelectorAll(selector);
        expect(elements.length).toBeGreaterThan(0);
        elements.forEach((element) => {
            expect(element.style.cssText).toBe(parsedStyle(css));
            // The old inline style is replaced, not merged.
            expect(element.style.color).toBe('');
        });
    });
}

// Run the jQuery UI datepicker translations of views/templates/translatelibs.ejs the way
// a page does (it sets jQuery.datepicker.regional.pt from translations/libs.yml).
let translateLibsScript;
async function renderTranslateLibs(locale) {
    // The i18n setup of app.js.
    const i18n = require('i18n-node-yaml')({
        translationFolder: path.join(ROOT, 'translations'),
        locales: ['en_GB', 'pt_PT'],
        defaultLocale: 'pt_PT',
    });
    await i18n.ready;
    const html = await ejs.renderFile(path.join(ROOT, 'views/templates/translatelibs.ejs'), i18n.api(locale));
    return html.trim().replace(/^<script>/, '').replace(/<\/script>$/, '');
}

function loadJQueryUI() {
    loadScript('vendor/js/jquery-ui.js');
    // translatelibs.ejs also translates the AnyPicker plugin, which is not under test.
    window.jQuery.AnyPicker = { i18n: {} };
    (0, eval)(translateLibsScript);
}

beforeAll(async () => {
    translateLibsScript = await renderTranslateLibs('pt_PT');
});

// The dates use the month names the jQuery UI datepicker had, without needing jQuery UI.
describe('dateFromTimestamp month names', () => {
    beforeEach(() => {
        delete window.jQuery;
        delete window.$;
        loadScript('vendor/js/jquery-1.12.4.js');
        loadJQueryUI();
    });

    afterEach(() => {
        delete window.jQuery;
        delete window.$;
        delete window.lang;
    });

    it.each(['pt', 'en'])('are the jQuery UI datepicker month names in "%s"', (language) => {
        loadScript('js/functions.js');
        window.lang = language;
        const { monthNames, monthNamesShort } = window.jQuery.datepicker.regional[language];

        expect(monthNames).toHaveLength(12);
        expect(monthNamesShort).toHaveLength(12);
        monthNames.forEach((name, i) => {
            const month = String(i + 1).padStart(2, '0');
            expect(dateFromTimestamp(`2020${month}10`, 'medium')).toBe(`10 ${name} 2020`);
            expect(dateFromTimestamp(`2020${month}10`, 'short')).toBe(`10 ${monthNamesShort[i]}`);
        });
    });
});

describeScript('js/functions.js', { html: PAGE }, ({ setup }) => {
    beforeEach(() => {
        // alertsMessageIn hides the alert with a timer.
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it.each(STYLE_CASES)('%s replaces the inline style', (name, styles) => {
        setup();

        window[name]();

        expectStyles(styles);
    });

    it.each(STYLE_CASES)('%s does nothing when its elements are missing', (name) => {
        setup('<p id="other" style="color: red"></p>');

        expect(() => window[name]()).not.toThrow();

        expect(document.getElementById('other').getAttribute('style')).toBe('color: red');
    });

    it('styles only the first element when an id is repeated, as jQuery did', () => {
        setup('<nav id="left-nav" style="color: red"></nav><nav id="left-nav" style="color: red"></nav>');

        openLeftMenuNav();

        const [first, second] = document.querySelectorAll('nav');
        expect(first.style.left).toBe('0px');
        expect(second.getAttribute('style')).toBe('color: red');
    });

    it('alertsMessageIn hides the alert again after 2 seconds', () => {
        setup();

        alertsMessageIn();
        jest.advanceTimersByTime(1999);
        expect(document.getElementById('alert-container').style.opacity).toBe('1');

        jest.advanceTimersByTime(1);
        expectStyles({ '#alert-container': 'height:0px;opacity:0;transition:0.5s' });
    });

    it('copyURLToClipboard copies the page URL and shows the alert', () => {
        setup();
        const copied = [];
        document.execCommand = jest.fn((command) => {
            // The input the function added for the copy.
            const input = document.body.lastElementChild;
            copied.push([command, input.value, input.selectionStart, input.selectionEnd]);
            return true;
        });
        const inputsBefore = document.querySelectorAll('input').length;

        try {
            copyURLToClipboard();
        } finally {
            delete document.execCommand;
        }

        const url = window.location.href;
        expect(copied).toEqual([['copy', url, 0, url.length]]);
        expect(document.querySelectorAll('input')).toHaveLength(inputsBefore);
        expect(document.getElementById('alert-container').style.opacity).toBe('1');
        jest.advanceTimersByTime(2000);
        expect(document.getElementById('alert-container').style.opacity).toBe('0');
    });

    describe('showTable and showList', () => {
        afterEach(() => {
            delete window.urlParam;
        });

        it.each([
            ['showTable', 'show-table', { '#replay-menu-table': 'display: block', '#replay-menu-list': 'display: none' }],
            ['showList', 'show-list', { '#replay-menu-list': 'display: block', '#replay-menu-table': 'display: none' }],
        ])('%s shows its view when table-results is "%s"', (name, value, styles) => {
            setup();
            window.urlParam = jest.fn(() => value);

            window[name]();

            expect(window.urlParam).toHaveBeenCalledWith('table-results');
            expectStyles(styles);
        });

        it.each([
            ['showTable', 'show-list'],
            ['showList', 'show-table'],
            ['showTable', null],
            ['showList', null],
        ])('%s changes nothing when table-results is %p', (name, value) => {
            setup();
            const before = document.body.innerHTML;
            window.urlParam = () => value;

            window[name]();

            expect(document.body.innerHTML).toBe(before);
        });

        it.each(['showTable', 'showList'])('%s does nothing when its elements are missing', (name) => {
            setup('');
            window.urlParam = () => (name === 'showTable' ? 'show-table' : 'show-list');

            expect(() => window[name]()).not.toThrow();
        });

        // No page defines urlParam; this is unchanged by the move away from jQuery.
        it.each(['showTable', 'showList'])('%s throws when urlParam is not defined', (name) => {
            setup();

            expect(() => window[name]()).toThrow(ReferenceError);
        });
    });

    it('openAdvancedSearchForm and closeAdvancedSearch show and hide the accordion', () => {
        setup();

        expect(openAdvancedSearchForm()).toBe(false);
        expect(document.getElementById('accordion').style.display).toBe('block');
        expect(document.getElementById('closeAdvancedSearch').style.display).toBe('block');

        expect(closeAdvancedSearch()).toBe(false);
        expect(document.getElementById('accordion').style.display).toBe('none');
    });

    describe('dateFromTimestamp', () => {
        afterEach(() => {
            delete window.lang;
        });

        it.each([
            ['pt', '20200102030405', 'long', '2 Janeiro 03h04, 2020'],
            ['pt', '20200102030405', 'medium', '2 Janeiro 2020'],
            ['pt', '20200102030405', 'short', '2 Jan'],
            ['pt', '19991231', 'long', '31 Dezembro 1999'],
            ['pt', '202003150859', 'long', '15 Março 08h59, 2020'],
            ['pt', '202003150859', 'unknown', '15 Março 08h59, 2020'],
            ['en', '20200102030405', 'long', '2 January 03h04, 2020'],
            ['en', '20200102030405', 'medium', '2 January 2020'],
            ['en', '20200102030405', 'short', '2 Jan'],
            ['en', '19991231', 'long', '31 December 1999'],
        ])('in "%s", formats %s as %s: %s', (language, timestamp, format, expected) => {
            setup('');
            window.lang = language;

            expect(dateFromTimestamp(timestamp, format)).toBe(expected);
        });

        it('uses the long format by default', () => {
            setup('');
            window.lang = 'pt';

            expect(dateFromTimestamp('20200102030405')).toBe('2 Janeiro 03h04, 2020');
        });

        it('shows the replayed date in the complete-page header (dynamic-header-url.js)', () => {
            setup('<a id="headerUrl" href="https://start.pt/">start.pt</a><span id="headerTimestamp"></span>');
            window.lang = 'pt';
            jest.spyOn(console, 'log').mockImplementation(() => {});
            loadScript('js/dynamic-header-url.js');

            window.dispatchEvent(new MessageEvent('message', {
                data: { wb_type: 'load', url: 'https://example.com/', ts: '20200102030405' },
            }));

            expect(document.getElementById('headerTimestamp').textContent).toBe('2 Janeiro 03h04, 2020');
        });
    });

    it('isMobile is true for a mobile user agent or a narrow window', () => {
        setup('');
        const matches = { value: false };
        window.matchMedia = jest.fn(() => ({ matches: matches.value }));
        const userAgent = jest.spyOn(window.navigator, 'userAgent', 'get');

        try {
            userAgent.mockReturnValue('Mozilla/5.0 (X11; Linux x86_64)');
            expect(isMobile()).toBe(false);
            expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 767px)');

            matches.value = true;
            expect(isMobile()).toBe(true);

            matches.value = false;
            userAgent.mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
            expect(isMobile()).toBe(true);
        } finally {
            delete window.matchMedia;
        }
    });

    it('onSectionLoad runs the callback when that section has loaded', () => {
        setup('');
        const callback = jest.fn();
        onSectionLoad('url-results-table', callback);
        const post = (data) => window.dispatchEvent(new MessageEvent('message', { data }));

        post({ arquivo_type: 'section-loaded', message: 'other-section' });
        post({ arquivo_type: 'other', message: 'url-results-table' });
        post('url-results-table');
        expect(callback).not.toHaveBeenCalled();

        post({ arquivo_type: 'section-loaded', message: 'url-results-table' });
        expect(callback).toHaveBeenCalledTimes(1);
    });

    // A top-level const or let in a classic script throws a SyntaxError when the script
    // runs a second time on the same page.
    it('can be included twice on a page', () => {
        const code = fs.readFileSync(path.join(ROOT, 'public/js/functions.js'), 'utf8');

        [1, 2].forEach(() => {
            const script = document.createElement('script');
            script.textContent = code;
            document.body.append(script);
        });

        // describeScript fails the test on any uncaught error, such as that SyntaxError.
        expect(typeof dateFromTimestamp).toBe('function');
    });
});
