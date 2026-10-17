/** @jest-environment jsdom */
const { loadScript } = require('./helpers/load-script.cjs');
const { fakeServer, flush } = require('./helpers/fake-server.cjs');

// The forms and the result modal from views/templates/body/body-services-citation-saver.ejs.
const PAGE = `
<section id="citation-saver-main">
  <input type="checkbox" name="consent-protection" id="consent-protection" required>
  <input type="checkbox" name="consent-processing" id="consent-processing" required>
  <div class="citation-saver-input-selection">
    <div class="input-tab">
      <form id="url-form" action="/services/citationsaver" method="post">
        <input type="text" name="url" id="input-url-url">
        <input type="text" name="email" id="input-url-email">
        <button type="submit">Send</button>
      </form>
    </div>
    <div class="input-tab">
      <form id="file-form" action="/services/citationsaver" method="post" enctype="multipart/form-data">
        <div id="input-file-selector"><button id="input-file-button" type="button">Choose</button><span id="input-file-text">No file</span></div>
        <input type="file" name="file" id="input-file-file">
        <input type="text" name="email" id="input-file-email">
        <button type="submit">Send</button>
      </form>
    </div>
  </div>
  <div id="modal" style="display:none">
    <section id="citation-saver-progress-bar"><div class="loader"></div></section>
    <section id="citation-saver-modal">
      <p class="text">Thank you</p>
      <p class="error" style="display:none"></p>
    </section>
  </div>
</section>`;

const $q = (selector) => document.querySelector(selector);
const isShown = (selector) => $q(selector).style.display !== 'none';
const json = (data) => ({ body: JSON.stringify(data) });

function giveConsent() {
    ['consent-protection', 'consent-processing'].forEach((id) => {
        const box = document.getElementById(id);
        box.checked = true;
        box.dispatchEvent(new Event('change', { bubbles: true }));
    });
}

function submit(formId) {
    const event = new Event('submit', { bubbles: true, cancelable: true });
    document.getElementById(formId).dispatchEvent(event);
    return event;
}

describe('citation-saver.js', () => {
    let server;
    let $;

    beforeAll(async () => {
        loadScript('vendor/js/jquery-1.12.4.js');
        loadScript('vendor/js/jquery.modal.min.js');
        $ = window.jQuery;
        await new Promise((resolve) => $(resolve));
    });

    beforeEach(async () => {
        document.body.innerHTML = PAGE;
        server = fakeServer();
        loadScript('js/citation-saver.js');
        await flush();
    });

    afterEach(() => {
        if ($.modal.isActive()) $.modal.close();
        $(document).off();
        server.restore();
        document.body.innerHTML = '';
    });

    it('keeps the fields disabled until both consents are given', () => {
        expect($q('#input-url-url').disabled).toBe(true);
        giveConsent();
        expect($q('#input-url-url').disabled).toBe(false);
    });

    it('sends nothing without consent', async () => {
        submit('url-form');
        await flush();
        expect(server.requests).toEqual([]);
    });

    it('POSTs the form as multipart FormData to the form action and shows the progress bar', async () => {
        server.respond('/services/citationsaver', json({ status: true, message: 'Link uploaded' }));
        giveConsent();
        $q('#input-url-url').value = 'https://example.com/';
        $q('#input-url-email').value = 'me@example.com';

        const event = submit('url-form');

        expect(event.defaultPrevented).toBe(true);
        expect(isShown('#citation-saver-progress-bar')).toBe(true);
        expect(isShown('#citation-saver-modal')).toBe(false);
        await flush();

        expect(server.requests).toHaveLength(1);
        const [request] = server.requests;
        expect(request.url).toBe('/services/citationsaver');
        expect(request.method).toBe('POST');
        expect(request.body).toBeInstanceOf(window.FormData);
        expect(request.body.get('url')).toBe('https://example.com/');
        expect(request.body.get('email')).toBe('me@example.com');
        // Sent as is, so the browser sets the multipart content type and its boundary.
        expect(request.init.headers).toBeUndefined();
        expect(request.init.credentials).toBe('same-origin');
    });

    it('shows the thank-you text when the server accepts the submission', async () => {
        server.respond('/services/citationsaver', json({ status: true, message: 'File uploaded' }));
        giveConsent();

        submit('file-form');
        await flush();

        expect(isShown('#modal p.text')).toBe(true);
        expect(isShown('#modal p.error')).toBe(false);
        expect(isShown('#citation-saver-progress-bar')).toBe(false);
        expect(isShown('#citation-saver-modal')).toBe(true);
    });

    it('shows the server message when the server refuses the submission', async () => {
        server.respond('/services/citationsaver', json({ status: false, message: 'Invalid <URL>' }));
        giveConsent();

        submit('url-form');
        await flush();

        expect(isShown('#modal p.text')).toBe(false);
        expect(isShown('#modal p.error')).toBe(true);
        expect($q('#modal p.error').textContent).toBe('Invalid <URL>');
        expect($q('#modal p.error').children).toHaveLength(0);
        expect(isShown('#citation-saver-progress-bar')).toBe(false);
        expect(isShown('#citation-saver-modal')).toBe(true);
    });

    it('shows a non-string server message as JSON', async () => {
        server.respond('/services/citationsaver', json({ status: false, message: { code: 7 } }));
        giveConsent();

        submit('url-form');
        await flush();

        expect($q('#modal p.error').textContent).toBe('{"code":7}');
    });

    it.each([
        ['an HTTP error', { status: 500, statusText: 'Internal Server Error', body: '<html>oops</html>' },
            '{"status":500,"statusText":"Internal Server Error"}'],
        ['a network error', { networkError: true }, '{"status":0,"statusText":"error"}'],
        ['a reply that is not JSON', { body: '<html>not json</html>' }, '{"status":200,"statusText":"parsererror"}'],
    ])('shows an error on %s', async (_case, response, message) => {
        server.respond('/services/citationsaver', response);
        giveConsent();

        submit('url-form');
        await flush();

        expect(isShown('#modal p.text')).toBe(false);
        expect(isShown('#modal p.error')).toBe(true);
        expect($q('#modal p.error').textContent).toBe(message);
        expect(isShown('#citation-saver-progress-bar')).toBe(false);
        expect(isShown('#citation-saver-modal')).toBe(true);
    });
    it('shows the chosen file name', () => {
        const input = $q('#input-file-file');
        Object.defineProperty(input, 'files', { value: [{ name: 'paper.pdf' }] });

        input.dispatchEvent(new Event('input', { bubbles: true }));

        expect($q('#input-file-text').textContent).toBe('paper.pdf');
    });
});
