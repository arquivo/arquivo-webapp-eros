/** @jest-environment jsdom */

'use strict';

const { describeScript, loadScript } = require('./helpers/load-script.cjs');

// The replay options menu (views/templates/menu/replay_right_nav_menu.ejs) and the
// "Search on site" modal (views/templates/header/header-replay.ejs), reduced.
const PAGE = `
<nav id="replay-right-nav"><ul>
  <li><span id="menuUrl">https://www.publico.pt/</span></li>
  <li><a id="menuSearchOnSite" href="#search-on-site" rel="modal:open">Search on site</a></li>
</ul></nav>
<section id="search-on-site" class="modal">
  <form id="search-on-site-form" action="/page/search" method="get">
    <input type="hidden" name="l" value="en">
    <input type="hidden" name="q" id="search-on-site-query">
    <p id="search-on-site-title">Search on site <strong id="search-on-site-host"></strong></p>
    <label for="search-on-site-terms">Search terms</label>
    <input type="search" id="search-on-site-terms">
    <div id="search-on-site-subdomains-option">
      <input type="checkbox" id="search-on-site-subdomains">
      <label for="search-on-site-subdomains">Include subdomains</label>
      <p id="search-on-site-subdomains-hint">Also searches addresses ending in <span id="search-on-site-hint-host"></span></p>
    </div>
    <button type="submit" id="search-on-site-pages" formaction="/page/search" disabled>Pages</button>
    <button type="submit" id="search-on-site-images" formaction="/image/search" disabled>Images</button>
    <button type="button" id="search-on-site-cancel">Cancel</button>
  </form>
</section>`;

const $id = (id) => document.getElementById(id);

const openModal = () => $id('menuSearchOnSite').click();

const type = (text) => {
    $id('search-on-site-terms').value = text;
    $id('search-on-site-terms').dispatchEvent(new Event('input', { bubbles: true }));
};

const press = (target, key, options = {}) => {
    const event = new KeyboardEvent('keydown', { key, which: key === 'Escape' ? 27 : 0, bubbles: true, cancelable: true, ...options });
    target.dispatchEvent(event);
    return event;
};

// requestSubmit(button) without the submitter, which jsdom does not set on the event.
const submit = (button = null) => {
    const event = new Event('submit', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'submitter', { value: button });
    $id('search-on-site-form').dispatchEvent(event);
};

const analyticsActions = () => (window.dataLayer || [])
    .filter((e) => e.event === 'replay_interaction')
    .map((e) => e.event_action);

describeScript('js/search-on-site.js', { html: PAGE }, ({ setup, whileParsing }) => {
    let submitted;

    beforeEach(() => {
        if (window.jQuery) {
            loadScript('vendor/js/jquery.modal.min.js');
        }
        window.dataLayer = [];
        // Records the submitted searches instead of navigating (jsdom does not navigate).
        submitted = [];
        document.addEventListener('submit', (e) => {
            if (!e.defaultPrevented) {
                submitted.push({ action: (e.submitter && e.submitter.getAttribute('formaction')) || e.target.getAttribute('action'), q: $id('search-on-site-query').value });
            }
            e.preventDefault();
        });
    });

    afterEach(() => {
        if (window.jQuery && window.jQuery.modal && window.jQuery.modal.isActive()) {
            window.jQuery.modal.close();
        }
        if (window.jQuery) {
            window.jQuery(document).off();
        }
        delete window.dataLayer;
    });

    it('shows the host of the page without www. and keeps the buttons disabled until terms are typed', () => {
        setup();
        openModal();

        expect($id('search-on-site-host').textContent).toBe('publico.pt');
        expect($id('search-on-site-hint-host').textContent).toBe('.publico.pt');
        expect($id('search-on-site-subdomains-option').hidden).toBe(false);
        expect($id('search-on-site-subdomains').checked).toBe(false);
        expect($id('search-on-site-pages').disabled).toBe(true);
        expect($id('search-on-site-images').disabled).toBe(true);

        type('   ');
        expect($id('search-on-site-pages').disabled).toBe(true);

        type('ronaldo');
        expect($id('search-on-site-pages').disabled).toBe(false);
        expect($id('search-on-site-images').disabled).toBe(false);
        expect(analyticsActions()).toEqual(['SearchOnSiteClick']);
    });

    it('searches pages with the site: term first and the terms unchanged', () => {
        setup();
        openModal();
        type(' ronaldo "a&b" #x ação ');

        submit($id('search-on-site-pages'));

        expect(submitted).toEqual([{ action: '/page/search', q: 'site:publico.pt ronaldo "a&b" #x ação' }]);
        expect(analyticsActions()).toEqual(['SearchOnSiteClick', 'SearchOnSitePagesClick']);
    });

    it('searches images of the site and its subdomains', () => {
        setup();
        openModal();
        type('eleições');
        $id('search-on-site-subdomains').checked = true;

        submit($id('search-on-site-images'));

        expect(submitted).toEqual([{ action: '/image/search', q: 'site:*.publico.pt eleições' }]);
        expect(analyticsActions()).toEqual(['SearchOnSiteClick', 'SearchOnSiteImagesClick']);
    });

    it('does not search without terms', () => {
        setup();
        openModal();

        submit();

        expect(submitted).toEqual([]);
    });

    it('reads the host again each time the modal opens', () => {
        setup();
        openModal();
        // replay.js updates #menuUrl when the replay moves to another page.
        $id('menuUrl').textContent = 'https://desporto.publico.pt/benfica';
        openModal();
        type('benfica');
        $id('search-on-site-subdomains').checked = true;

        submit($id('search-on-site-pages'));

        expect($id('search-on-site-host').textContent).toBe('desporto.publico.pt');
        expect(submitted).toEqual([{ action: '/page/search', q: 'site:*.desporto.publico.pt benfica' }]);
    });

    it.each([
        ['https://WWW.Sapo.PT:8080/a', 'sapo.pt'],
        ['http://www.pt/', 'www.pt'],
        ['http://wwwx.pt/', 'wwwx.pt'],
    ])('takes the host of %s as %s', (url, host) => {
        setup();
        $id('menuUrl').textContent = url;
        openModal();

        expect($id('search-on-site-host').textContent).toBe(host);
    });

    it('offers no subdomains for an IP address', () => {
        setup();
        $id('search-on-site-subdomains').checked = true;
        $id('menuUrl').textContent = 'http://10.0.0.1/';
        openModal();
        type('x');

        submit($id('search-on-site-pages'));

        expect($id('search-on-site-subdomains-option').hidden).toBe(true);
        expect(submitted).toEqual([{ action: '/page/search', q: 'site:10.0.0.1 x' }]);
    });

    it('does not search when the page URL has no host', () => {
        setup();
        $id('menuUrl').textContent = 'not a url';
        openModal();
        type('x');

        expect($id('search-on-site-pages').disabled).toBe(true);
        submit();
        expect(submitted).toEqual([]);
    });

    it('keeps Tab inside the modal', () => {
        setup();
        openModal();
        type('x');
        const terms = $id('search-on-site-terms');
        // jquery-modal adds its close link at the end of the modal.
        const last = $id('search-on-site').querySelector('a.close-modal') || $id('search-on-site-cancel');

        last.focus();
        expect(press(last, 'Tab').defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(terms);

        expect(press(terms, 'Tab', { shiftKey: true }).defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(last);

        terms.focus();
        expect(press(terms, 'Tab').defaultPrevented).toBe(false);
    });

    it('binds to the menu once the document is parsed', async () => {
        const fireDOMContentLoaded = await whileParsing();
        setup();
        openModal();
        expect($id('search-on-site-host').textContent).toBe('');

        fireDOMContentLoaded();
        openModal();
        expect($id('search-on-site-host').textContent).toBe('publico.pt');
    });

    it('focuses the input when the modal opens and the menu entry when it closes', () => {
        if (!window.jQuery) {
            return;
        }
        setup();

        openModal();
        expect(window.jQuery.modal.isActive()).toBe(true);
        expect(document.activeElement).toBe($id('search-on-site-terms'));

        press($id('search-on-site-terms'), 'Escape');
        expect(window.jQuery.modal.isActive()).toBe(false);
        expect(document.activeElement).toBe($id('menuSearchOnSite'));

        openModal();
        $id('search-on-site-cancel').click();
        expect(window.jQuery.modal.isActive()).toBe(false);
        expect(document.activeElement).toBe($id('menuSearchOnSite'));
    });
});
