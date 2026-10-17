/** @jest-environment jsdom */

'use strict';

const { loadScript } = require('./helpers/load-script.cjs');
const { fakeServer, flush } = require('./helpers/fake-server.cjs');

function imageCard(index) {
    const data = {
        imgTitle: ['Image ' + index], imgAlt: ['Alt ' + index], imgSrc: 'https://example.com/' + index + '.png',
        imgTstamp: '20200102030405', imgLinkToArchive: '/wayback/20200102030405im_/https://example.com/' + index + '.png',
        pageURL: 'https://example.com/', pageTstamp: '20200102030405', pageLinkToArchive: '/wayback/20200102030405/https://example.com/',
    };
    // As views/templates/fragments/image-result.ejs renders it.
    return `
<li class="image-card" id="image-card-${index}" data-index="${index}">
  <form style="display: none;" id="search-result-form-${index}" action="/image/view/track_${index}/20200102030405/https%3A%2F%2Fexample.com%2F${index}.png"></form>
  <a href="#modal" class="results-image"><img src="x.png"></a>
  <div class="image-data" style="display:none">${JSON.stringify(data).replace(/</g, '&lt;')}</div>
</li>`;
}

const PAGE = `<ul id="images-results">${imageCard(1)}${imageCard(2)}</ul><div id="modal"></div>`;

// views/partials/modal-image-details.ejs, reduced.
const MODAL_IMAGE_DETAILS = `
<section class="modal-image-details-container">
  <button id="previous-image-button" class="image-navigation-button"></button>
  <button id="next-image-button" class="image-navigation-button"></button>
  <a href="" id="image-container-a"><img class="image-display" src="/img/placeholder.jpg"></a>
  <div class="modal-image-field"><p><a class="image-title image-modal-content"></a></p></div>
  <p class="raw-api-data"></p>
</section>`;

const click = (selector) => document.querySelector(selector)
    .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

describe('modal-image-result.js', () => {
    let server;
    let $;

    beforeAll(async () => {
        loadScript('vendor/js/jquery-1.12.4.js');
        loadScript('vendor/js/jquery.modal.min.js');
        $ = window.jQuery;
        await new Promise((resolve) => $(resolve));
    });

    beforeEach(() => {
        // Globals from translatelibs.ejs and functions.js.
        window.lang = 'pt';
        window.isMobile = () => false;
        window.dateFromTimestamp = (ts) => 'date(' + ts + ')';
        jest.spyOn(window.history, 'pushState').mockImplementation(() => {});
        document.body.innerHTML = PAGE;
        server = fakeServer();
    });

    afterEach(() => {
        if ($.modal.isActive()) $.modal.close();
        $(document).off();
        $('#modal').off();
        document.onkeydown = null;
        jest.restoreAllMocks();
        server.restore();
        document.body.innerHTML = '';
        delete window.lang;
        delete window.isMobile;
        delete window.dateFromTimestamp;
    });

    it('loads the image details modal in the page language', async () => {
        loadScript('js/modal-image-result.js');
        await flush();

        expect(server.requests.map((r) => [r.method, r.url])).toEqual([['GET', '/partials/modal-image-details?l=pt']]);
    });

    it('shows the loaded modal with the clicked image and logs the view', async () => {
        server.respond('/partials/modal-image-details', { body: MODAL_IMAGE_DETAILS });
        loadScript('js/modal-image-result.js');
        await flush();

        click('#image-card-2 img');
        await flush();

        const modal = document.getElementById('modal');
        expect(modal.querySelector('.modal-image-details-container')).not.toBeNull();
        expect(modal.querySelector('a.image-title').textContent).toBe('Image 2');
        expect(modal.querySelector('img.image-display').getAttribute('src')).toBe('/wayback/20200102030405im_/https://example.com/2.png');
        // The view is logged by requesting the card's hidden form action (src/tracking.js).
        expect(server.requests.map((r) => [r.method, r.url])).toEqual([
            ['GET', '/partials/modal-image-details?l=pt'],
            ['GET', '/image/view/track_2/20200102030405/https%3A%2F%2Fexample.com%2F2.png'],
        ]);
    });

    it('ignores a failed view log', async () => {
        server.respond('/partials/modal-image-details', { body: MODAL_IMAGE_DETAILS });
        server.respond('/image/view/', { networkError: true });
        loadScript('js/modal-image-result.js');
        await flush();

        click('#image-card-1 img');
        await flush();

        expect(document.querySelector('#modal a.image-title').textContent).toBe('Image 1');
    });

    it('slides to the next image with a fresh copy of the loaded modal', async () => {
        server.respond('/partials/modal-image-details', { body: MODAL_IMAGE_DETAILS });
        loadScript('js/modal-image-result.js');
        await flush();
        click('#image-card-1 img');
        $.fx.off = true;

        click('#modal #next-image-button');
        await flush();
        $.fx.off = false;

        const containers = document.querySelectorAll('#modal .modal-image-details-container');
        expect(containers).toHaveLength(1);
        expect(containers[0].querySelector('a.image-title').textContent).toBe('Image 2');
    });

    it.each([
        ['an HTTP error', { status: 404, body: 'Not Found' }],
        ['a network error', { networkError: true }],
    ])('leaves the modal empty on %s', async (_case, response) => {
        server.respond('/partials/modal-image-details', response);
        loadScript('js/modal-image-result.js');
        await flush();

        document.getElementById('modal').innerHTML = 'previous';
        click('#image-card-1 img');
        await flush();

        expect(document.querySelector('#modal .modal-image-details-container')).toBeNull();
        expect(document.getElementById('modal').textContent).not.toContain('Not Found');
    });

    it('requests nothing on pages without image results', async () => {
        document.body.innerHTML = '<div id="modal"></div>';

        loadScript('js/modal-image-result.js');
        await flush();

        expect(server.requests).toEqual([]);
    });
});
