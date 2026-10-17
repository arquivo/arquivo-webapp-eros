/** @jest-environment jsdom */

'use strict';

const { loadScript } = require('./helpers/load-script.cjs');
const { fakeServer, flush } = require('./helpers/fake-server.cjs');

// The date slider from the search tools (views/templates/search-tools*.ejs), reduced to
// what datepicker.js reads.
const SEARCH_TOOLS = `
<div id="search-tools-date-slider">
  <input id="start-date" value="19960101"><input id="start-year"><input id="start-day-month">
  <input id="end-date" value="20201231"><input id="end-year"><input id="end-day-month">
  <div id="slider-range"></div>
  <button class="call-datepicker-start-year">start</button>
  <button class="call-datepicker-end-year">end</button>
</div>
<div id="modal"></div>`;

// views/partials/modal-datepicker.ejs
const MODAL_DATEPICKER = `
<section id="modal-datepicker-container">
  <h4 id="modal-datepicker-title"></h4>
  <input size="10" type="text" id="modal-datepicker-input">
  <div id="modal-datepicker-datepicker"></div>
  <button id="modal-datepicker-confirm-button">OK</button>
</section>`;

const click = (selector) => document.querySelector(selector)
    .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

describe('datepicker.js', () => {
    let server;
    let $;

    beforeAll(async () => {
        loadScript('vendor/js/jquery-1.12.4.js');
        $ = window.jQuery;
        await new Promise((resolve) => $(resolve));
    });

    beforeEach(() => {
        // Globals from translatelibs.ejs, functions.js and the jQuery plugins the page loads.
        window.lang = 'en';
        window.translations = { 'modal-datepicker': { header: { start: { en: 'Start date' }, end: { en: 'End date' } } } };
        window.isMobile = () => false;
        $.datepicker = { regional: { en: { monthNames: [], monthNamesShort: [] } } };
        $.fn.datepicker = jest.fn(function () { return this; });
        $.fn.slider = jest.fn(function () { return this; });
        $.fn.inputmask = jest.fn(function () { return this; });
        $.fn.modal = jest.fn(function () { return this; });
        document.body.innerHTML = SEARCH_TOOLS;
        server = fakeServer();
    });

    afterEach(() => {
        $(document).off();
        server.restore();
        document.body.innerHTML = '';
        delete window.lang;
        delete window.translations;
        delete window.isMobile;
    });

    it('loads the datepicker modal in the page language', async () => {
        server.respond('/partials/modal-datepicker', { body: MODAL_DATEPICKER });

        loadScript('js/datepicker.js');
        await flush();

        expect(server.requests.map((r) => [r.method, r.url])).toEqual([['GET', '/partials/modal-datepicker?l=en']]);
    });

    it('opens the loaded modal when a date is clicked', async () => {
        server.respond('/partials/modal-datepicker', { body: MODAL_DATEPICKER });
        loadScript('js/datepicker.js');
        await flush();

        click('.call-datepicker-start-year');

        expect(document.querySelector('#modal #modal-datepicker-container')).not.toBeNull();
        expect(document.getElementById('modal-datepicker-title').textContent).toBe('Start date');
        expect(document.getElementById('modal-datepicker-input').value).toBe('01/01/1996');
        expect($.fn.modal).toHaveBeenCalled();
    });

    it.each([
        ['an HTTP error', { status: 500, body: '<h1>Server error</h1>' }],
        ['a network error', { networkError: true }],
    ])('leaves the modal empty on %s', async (_case, response) => {
        server.respond('/partials/modal-datepicker', response);
        loadScript('js/datepicker.js');
        await flush();

        // As before the move to fetch, a click with no modal loaded throws (no input to select).
        const swallow = (e) => e.preventDefault();
        window.addEventListener('error', swallow);
        document.getElementById('modal').innerHTML = 'previous';
        click('.call-datepicker-end-year');
        window.removeEventListener('error', swallow);

        expect(document.getElementById('modal').innerHTML).toBe('');
    });

    it('requests nothing on pages without the date slider', async () => {
        document.body.innerHTML = '<div id="modal"></div>';

        loadScript('js/datepicker.js');
        await flush();

        expect(server.requests).toEqual([]);
    });
});
