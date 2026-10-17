/** @jest-environment jsdom */

'use strict';

const { describeScript } = require('./helpers/load-script.cjs');

// Trimmed copy of views/templates/fragments/loading-section.ejs, as the replay page
// renders it in its left menu (views/templates/menu/left_nav_replay_menu.ejs).
const LOADING_SECTION = `
<nav id="replay-left-nav">
  <h3>Replay left menu navigation</h3>
  <section id="loading-section" onloadmessage="date">
    <h3>Loading</h3>
    <form id="loading-form" action="/partials/replay-nav">
      <input type="hidden" name="q" value="arquivo pt">
      <input type="hidden" name="l" value="en">
      <button id="loading-results" type="submit" value="loading results" aria-hidden="true">Load</button>
    </form>
    <div class="preloader"></div>
  </section>
  <footer id="after-section"></footer>
</nav>`;

const PAGE = `
<main>
  <ul><li><a id="blocked" class="results-url blockUrl" href="#blocked">blocked</a></li></ul>
  <a id="free" href="#free">free</a>
  <form id="search-form" action="/page/search">
    <input name="q" value="arquivo">
    <button id="search-button" type="submit">Search</button>
  </form>
  <form id="other-form" action="/services/savepagenow"><input name="url" value="x"></form>
</main>`;

// Partial with an inline script, like views/partials/url-list-results.ejs.
const PARTIAL_WITH_SCRIPT = `<section id="loaded">
  <button class="accordion-replay-list">2020</button>
</section>
<script>
  window.partialScriptRuns = (window.partialScriptRuns || 0) + 1;
  window.partialScriptSawContent = !!document.querySelector('#loaded .accordion-replay-list');
  window.partialScriptSawLoadingSection = !!document.getElementById('loading-section');
</script>
<script type="text/template"><p>window.templateScriptRan = true;</p></script>`;

const $id = (id) => document.getElementById(id);
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
// Responses arrive in a later task; the message posted after them in one more.
const settleAll = async () => {
    for (let i = 0; i < 5; i++) await settle();
};

// A fake same-origin server behind a fake fetch (jsdom has no fetch API).
let requests;
let respond;

function record(url, method, headers, redirect) {
    requests.push({ url, method, headers, redirect });
    return respond(url);
}

function fakeFetch(url, init = {}) {
    const headers = Object.fromEntries(new Headers(init.headers || {}));
    return new Promise((resolve, reject) => setTimeout(() => {
        const { status, body, networkError } = record(String(url), init.method || 'GET', headers, init.redirect || 'follow');
        if (networkError) {
            reject(new TypeError('Failed to fetch'));
            return;
        }
        resolve({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(body) });
    }));
}

// Minimal Headers for the fake fetch.
class Headers {
    constructor(init) { this.entries = Object.entries(init).map(([k, v]) => [k.toLowerCase(), v]); }
    [Symbol.iterator]() { return this.entries[Symbol.iterator](); }
}

function clearCookie() {
    document.cookie = 'client_id=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
}

// Fire a submit event the way the browser does before it submits a form.
function submit(form) {
    const event = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(event);
    return event;
}

function click(element) {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    return event;
}

describeScript('js/init.js', { html: PAGE }, ({ setup, whileParsing }) => {
    let messages;
    let originalPostMessage;
    let removeBodyListeners;

    beforeEach(() => {
        requests = [];
        respond = () => ({ status: 200, body: '<section id="loaded">Loaded</section>' });
        window.fetch = fakeFetch;
        clearCookie();
        delete window.partialScriptRuns;
        delete window.partialScriptSawContent;
        delete window.partialScriptSawLoadingSection;
        delete window.templateScriptRan;

        // jsdom's postMessage needs a targetOrigin; browsers default it to the page's origin.
        messages = [];
        originalPostMessage = window.postMessage;
        window.postMessage = (...args) => messages.push({
            args,
            sectionLoaded: !!$id('loaded'),
            scriptRuns: window.partialScriptRuns,
        });

        // The helper cleans up window and document listeners; init.js also listens on <body>,
        // which outlives each test.
        const added = [];
        document.body.addEventListener = function (type, listener, options) {
            added.push([type, listener, options]);
            return HTMLElement.prototype.addEventListener.call(this, type, listener, options);
        };
        removeBodyListeners = () => {
            delete document.body.addEventListener;
            added.forEach(([type, listener, options]) => document.body.removeEventListener(type, listener, options));
        };
    });

    afterEach(() => {
        removeBodyListeners();
        delete window.fetch;
        window.postMessage = originalPostMessage;
        clearCookie();
    });

    describe('#modal', () => {
        it('appends an empty #modal div to <body> when the page has none', () => {
            setup();

            const modal = $id('modal');
            expect(modal).not.toBeNull();
            expect(modal.parentNode).toBe(document.body);
            expect(document.body.lastElementChild).toBe(modal);
            expect(modal.outerHTML).toBe('<div id="modal" onclick="closeReplayRightMenuNav()"></div>');
        });

        it('keeps the page\'s own #modal and does not add another', () => {
            setup(`${PAGE}<section><div id="modal" style="display:none"><p class="text"></p></div></section>`);

            expect(document.querySelectorAll('#modal')).toHaveLength(1);
            expect($id('modal').parentNode.tagName).toBe('SECTION');
            expect($id('modal').getAttribute('onclick')).toBeNull();
        });

        it('calls closeReplayRightMenuNav when the created #modal is clicked', () => {
            setup();
            window.closeReplayRightMenuNav = jest.fn();

            $id('modal').click();

            expect(window.closeReplayRightMenuNav).toHaveBeenCalledTimes(1);
            delete window.closeReplayRightMenuNav;
        });
    });

    describe('a.blockUrl links', () => {
        it('cancels clicks on a.blockUrl links, without stopping the click from bubbling', () => {
            setup();
            const bubbled = jest.fn();
            document.body.addEventListener('click', bubbled);

            expect(click($id('blocked')).defaultPrevented).toBe(true);
            expect(bubbled).toHaveBeenCalledTimes(1);
        });

        it('leaves other links alone', () => {
            setup(`${PAGE}<span class="blockUrl"><a id="inside" href="#inside">x</a></span>`);

            expect(click($id('free')).defaultPrevented).toBe(false);
            expect(click($id('inside')).defaultPrevented).toBe(false);
        });

        it('binds only the a.blockUrl links that exist when the page is ready', () => {
            setup();
            document.body.insertAdjacentHTML('beforeend', '<a id="later" class="blockUrl" href="#later">later</a>');

            expect(click($id('later')).defaultPrevented).toBe(false);
        });
    });

    describe('#loading-section', () => {
        it('requests the loading form\'s action with its fields, from the page\'s origin', async () => {
            setup(LOADING_SECTION);
            await settleAll();

            expect(requests).toHaveLength(1);
            expect(requests[0].url).toBe('http://localhost/partials/replay-nav?q=arquivo+pt&l=en');
            expect(requests[0].method).toBe('GET');
            // jQuery marks same-origin requests with this header; kept for the server's sake.
            expect(requests[0].headers['x-requested-with']).toBe('XMLHttpRequest');
            // The partial routes never redirect: a redirect fails the request.
            expect(requests[0].redirect).toBe('error');
        });

        it('replaces the section with the response and then posts the onloadmessage', async () => {
            setup(LOADING_SECTION);
            await settleAll();

            expect($id('loading-section')).toBeNull();
            expect($id('loading-form')).toBeNull();
            const loaded = $id('loaded');
            expect(loaded.textContent).toBe('Loaded');
            expect(loaded.parentNode).toBe($id('replay-left-nav'));
            expect(loaded.nextElementSibling).toBe($id('after-section'));
            expect(messages).toEqual([
                { args: [{ arquivo_type: 'section-loaded', message: 'date' }], sectionLoaded: true, scriptRuns: undefined },
            ]);
        });

        it('posts the onloadmessage as written, even when it is JSON', async () => {
            setup(LOADING_SECTION.replace('onloadmessage="date"', 'onloadmessage="{&quot;a&quot;:1}"'));
            await settleAll();

            expect(messages.map((m) => m.args)).toEqual([[{ arquivo_type: 'section-loaded', message: '{"a":1}' }]]);
        });

        it.each([
            ['empty', 'onloadmessage=""'],
            ['missing', ''],
        ])('posts no message when the onloadmessage is %s', async (_label, attribute) => {
            setup(LOADING_SECTION.replace('onloadmessage="date"', attribute));
            await settleAll();

            expect($id('loaded')).not.toBeNull();
            expect(messages).toEqual([]);
        });

        it('inserts every node of the response in place of the section', async () => {
            respond = () => ({ status: 200, body: ' <h4 id="a">A</h4>text<p id="b">B</p><!-- c -->' });
            setup(LOADING_SECTION);
            await settleAll();

            const nav = $id('replay-left-nav');
            expect(nav.innerHTML).toBe('\n  <h3>Replay left menu navigation</h3>\n   <h4 id="a">A</h4>text<p id="b">B</p><!-- c -->'
                + '\n  <footer id="after-section"></footer>\n');
        });

        it('removes the section when the response is empty', async () => {
            respond = () => ({ status: 200, body: '' });
            setup(LOADING_SECTION);
            await settleAll();

            expect($id('loading-section')).toBeNull();
            expect(messages.map((m) => m.args[0].message)).toEqual(['date']);
        });

        it('runs the inline scripts of the response once it is in the page, before the message', async () => {
            respond = () => ({ status: 200, body: PARTIAL_WITH_SCRIPT });
            setup(LOADING_SECTION);
            await settleAll();

            expect(window.partialScriptRuns).toBe(1);
            expect(window.partialScriptSawContent).toBe(true);
            expect(window.partialScriptSawLoadingSection).toBe(false);
            expect(window.templateScriptRan).toBeUndefined();
            // The scripts stay in the page, like any other node of the response.
            expect($id('replay-left-nav').querySelectorAll('script')).toHaveLength(2);
            expect(messages).toEqual([
                { args: [{ arquivo_type: 'section-loaded', message: 'date' }], sectionLoaded: true, scriptRuns: 1 },
            ]);
        });

        it('runs only the classic JavaScript scripts of the response, like jQuery', async () => {
            const runs = (type) => `<script${type}>window.ranTypes.push('${type}');</script>`;
            const ran = [' type=""', '', ' type="text/javascript"', ' type="application/javascript"', ' type="text/ecmascript"'];
            const inert = [' type="module"', ' type="importmap"', ' type="application/ld+json"', ' type="text/template"'];
            window.ranTypes = [];
            respond = () => ({ status: 200, body: [...ran, ...inert].map(runs).join('') });
            setup(LOADING_SECTION);
            await settleAll();

            expect(window.ranTypes).toEqual(ran);
            // The others are left as they were parsed.
            const scripts = Array.from($id('replay-left-nav').querySelectorAll('script'), (el) => el.outerHTML);
            expect(scripts).toEqual([...ran, ...inert].map(runs));
            delete window.ranTypes;
        });

        it.each([404, 500])('leaves the section and posts nothing when the response is HTTP %i', async (status) => {
            respond = () => ({ status, body: '<section id="loaded">Error page</section>' });
            setup(LOADING_SECTION);
            await settleAll();

            expect(requests).toHaveLength(1);
            expect($id('loading-section')).not.toBeNull();
            expect($id('loaded')).toBeNull();
            expect(messages).toEqual([]);
        });

        it('leaves the section and posts nothing when the request fails', async () => {
            respond = () => ({ networkError: true });
            setup(LOADING_SECTION);
            await settleAll();

            expect(requests).toHaveLength(1);
            expect($id('loading-section')).not.toBeNull();
            expect(messages).toEqual([]);
        });

        it('requests an absolute action on the page\'s own origin', async () => {
            setup(LOADING_SECTION.replace('action="/partials/replay-nav"', 'action="http://localhost/partials/x"'));
            await settleAll();

            expect(requests.map((r) => r.url)).toEqual(['http://localhost/partials/x?q=arquivo+pt&l=en']);
        });

        it.each([
            ['on another origin', 'action="https://evil.example/partials/replay-nav"'],
            ['protocol-relative', 'action="//evil.example/partials/replay-nav"'],
            ['a javascript: URL', 'action="javascript:window.actionRan=true"'],
            ['not a valid URL', 'action="http://[::1/partials/replay-nav"'],
            ['empty', 'action=""'],
            ['missing', ''],
        ])('makes no request and leaves the section when the loading form\'s action is %s', async (_label, attribute) => {
            setup(LOADING_SECTION.replace('action="/partials/replay-nav"', attribute));
            await settleAll();

            expect(requests).toEqual([]);
            expect($id('loading-section')).not.toBeNull();
            expect(messages).toEqual([]);
            expect(window.actionRan).toBeUndefined();
        });

        it('makes no request and leaves the section when the page has no #loading-form', async () => {
            setup('<section id="loading-section" onloadmessage="date"><div class="preloader"></div></section>');
            await settleAll();

            expect(requests).toEqual([]);
            expect($id('loading-section')).not.toBeNull();
            expect(messages).toEqual([]);
        });

        it('makes no request on pages without a #loading-section', async () => {
            setup();
            await settleAll();

            expect(requests).toEqual([]);
            expect(messages).toEqual([]);
        });
    });

    describe('loading form fields (jQuery\'s form.serialize())', () => {
        // Fields that are and are not sent, and values that need encoding. (Not here: a selected
        // disabled <option>, which jsdom's FormData keeps but browsers and jQuery leave out;
        // e2e/webapp/init/InitScriptTest.spec.js checks it in real browsers.)
        const TRICKY_FORM = `
<section id="loading-section">
  <form id="loading-form" action="/partials/pages-search-results">
    <input type="hidden" name="q" value="a b&amp;c=d+e%f/g?h#i*j.k-l_m">
    <input type="hidden" name="accents" value="ação €">
    <input type="text" name="text" value="typed">
    <input type="hidden" name="" value="no name">
    <input type="hidden" value="no name either">
    <input type="hidden" name="disabled" value="x" disabled>
    <input type="checkbox" name="unchecked" value="x">
    <input type="checkbox" name="checked" value="yes" checked>
    <input type="checkbox" name="checked-no-value" checked>
    <input type="radio" name="radio" value="r1">
    <input type="radio" name="radio" value="r2" checked>
    <select name="single"><option value="s1">S1</option><option selected>s 2</option></select>
    <select name="multi" multiple>
      <option value="m1" selected>M1</option><option value="m2">M2</option><option value="m3" selected>M3</option>
    </select>
    <select name="empty-multi" multiple><option value="e1">E1</option></select>
    <textarea name="area">one line</textarea>
    <input type="file" name="file">
    <input type="submit" name="submit" value="Submit">
    <input type="image" name="image" alt="go">
    <input type="reset" name="reset" value="Reset">
    <input type="button" name="button" value="Button">
    <button type="submit" name="button-element" value="b">B</button>
    <input type="hidden" name="q" value="repeated">
  </form>
</section>
<input type="hidden" name="outside" value="x">`;
        const EXPECTED = [
            'q=a+b%26c%3Dd%2Be%25f%2Fg%3Fh%23i*j.k-l_m',
            'accents=a%C3%A7%C3%A3o+%E2%82%AC',
            'text=typed',
            'checked=yes',
            'checked-no-value=on',
            'radio=r2',
            'single=s+2',
            'multi=m1',
            'multi=m3',
            'area=one+line',
            'q=repeated',
        ].join('&');

        it('sends the fields a form submission sends, encoded as jQuery did', async () => {
            setup(TRICKY_FORM);
            if (window.jQuery) {
                expect(window.jQuery('#loading-form').serialize()).toBe(EXPECTED);
            }
            await settleAll();

            expect(requests[0].url).toBe(`http://localhost/partials/pages-search-results?${EXPECTED}`);
        });

        it('sends the same values as jQuery for characters jQuery left unencoded', async () => {
            const value = "it's (not) ~ok! *";
            setup(TRICKY_FORM.replace('value="typed"', `value="${value}"`));
            const jQueryEntries = window.jQuery?.('#loading-form').serializeArray().map((x) => [x.name, x.value]);
            await settleAll();

            const sent = new URL(requests[0].url).searchParams;
            expect(sent.get('text')).toBe(value);
            if (jQueryEntries) {
                expect(Array.from(sent)).toEqual(jQueryEntries);
            }
        });

        it('sends an empty query when the loading form has no fields', async () => {
            setup('<section id="loading-section"><form id="loading-form" action="/partials/x"></form></section>');
            await settleAll();

            expect(requests[0].url).toBe('http://localhost/partials/x?');
        });
    });

    describe('trackingId on search form submissions', () => {
        const trackingInputs = (form) => form.querySelectorAll('input[name=trackingId]');

        it('appends a hidden trackingId input to forms whose action contains "search"', () => {
            setup();
            const form = $id('search-form');

            const event = submit(form);

            expect(event.defaultPrevented).toBe(false);
            const inputs = trackingInputs(form);
            expect(inputs).toHaveLength(1);
            expect(form.lastElementChild).toBe(inputs[0]);
            const value = inputs[0].value;
            expect(value).toMatch(/^[0-9a-f]{20}_[0-9a-f]{20}$/);
            expect(inputs[0].outerHTML).toBe(`<input type="hidden" name="trackingId" value="${value}">`);
            // It is part of the submitted form data.
            expect(new FormData(form).get('trackingId')).toBe(value);
        });

        it('starts the trackingId with the client id, saving a new one in the client_id cookie', () => {
            setup();

            submit($id('search-form'));

            const clientId = document.cookie.match(/(?:^|; )client_id=([0-9a-f]{20})/)[1];
            expect(trackingInputs($id('search-form'))[0].value.split('_')[0]).toBe(clientId);
        });

        it('reuses the client id already in the cookie, with a new id each time', () => {
            document.cookie = 'client_id=0123456789abcdef0123; path=/';
            setup(`${PAGE}<form id="search-2" action="/image/search"></form>`);

            submit($id('search-form'));
            submit($id('search-2'));

            const [first, second] = [$id('search-form'), $id('search-2')].map((f) => trackingInputs(f)[0].value);
            expect(first).toMatch(/^0123456789abcdef0123_[0-9a-f]{20}$/);
            expect(second).toMatch(/^0123456789abcdef0123_[0-9a-f]{20}$/);
            expect(first).not.toBe(second);
        });

        it('keeps a trackingId input the form already has, so it adds one only once', () => {
            setup(`<form id="f" action="/page/search"><div><input type="hidden" name="trackingId" value="kept"></div></form>`);

            submit($id('f'));
            submit($id('f'));

            expect(trackingInputs($id('f'))).toHaveLength(1);
            expect(trackingInputs($id('f'))[0].value).toBe('kept');
        });

        it('leaves forms whose action does not contain "search" alone', () => {
            setup();

            submit($id('other-form'));

            expect(trackingInputs($id('other-form'))).toHaveLength(0);
            expect(document.cookie).not.toMatch(/client_id=/);
        });

        it('handles search forms added to the page after it loaded', () => {
            setup();
            document.querySelector('main').insertAdjacentHTML('beforeend',
                '<div><form id="nav-form" action="/page/search"><input name="start" value="10"></form></div>');

            submit($id('nav-form'));

            expect(trackingInputs($id('nav-form'))).toHaveLength(1);
        });

        it('runs after the form\'s own submit listeners, and not when they stop the event', () => {
            setup(`${PAGE}<form id="stopped" action="/page/search"></form>`);
            let seenByForm;
            $id('search-form').addEventListener('submit', () => {
                seenByForm = trackingInputs($id('search-form')).length;
            });
            $id('stopped').addEventListener('submit', (e) => e.stopPropagation());

            submit($id('search-form'));
            submit($id('stopped'));

            expect(seenByForm).toBe(0);
            expect(trackingInputs($id('search-form'))).toHaveLength(1);
            expect(trackingInputs($id('stopped'))).toHaveLength(0);
        });

        it('adds the input on a real submission (submit button click)', () => {
            setup();
            let submitted;
            document.addEventListener('submit', (e) => {
                submitted = new FormData(e.target);
                e.preventDefault(); // jsdom cannot navigate
            });

            $id('search-button').click();

            expect(submitted.get('q')).toBe('arquivo');
            expect(submitted.get('trackingId')).toMatch(/^[0-9a-f]{20}_[0-9a-f]{20}$/);
        });
    });

    describe('timing', () => {
        it('does nothing until DOMContentLoaded when loaded from <head>', async () => {
            const fireDOMContentLoaded = await whileParsing();
            setup(`${PAGE}${LOADING_SECTION}`);
            await settleAll();

            expect($id('modal')).toBeNull();
            expect(click($id('blocked')).defaultPrevented).toBe(false);
            expect(requests).toEqual([]);
            submit($id('search-form'));
            expect($id('search-form').querySelector('input[name=trackingId]')).toBeNull();

            fireDOMContentLoaded();
            await settleAll();

            expect($id('modal')).not.toBeNull();
            expect(click($id('blocked')).defaultPrevented).toBe(true);
            expect(requests).toHaveLength(1);
            submit($id('search-form'));
            expect($id('search-form').querySelector('input[name=trackingId]')).not.toBeNull();
        });

        it('creates #modal before the ready callbacks of later scripts look for it', async () => {
            // datepicker.js and modal-image-result.js keep `$('#modal')` from their $(fn).
            const fireDOMContentLoaded = await whileParsing();
            setup();
            const seen = [];
            if (window.jQuery) {
                window.jQuery(() => seen.push(['$(fn)', !!$id('modal')]));
            }
            document.addEventListener('DOMContentLoaded', () => seen.push(['DOMContentLoaded', !!$id('modal')]));

            fireDOMContentLoaded();

            expect(seen).toEqual([
                ...(window.jQuery ? [['$(fn)', true]] : []),
                ['DOMContentLoaded', true],
            ]);
        });
    });
});
