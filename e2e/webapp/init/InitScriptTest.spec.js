const { test, expect } = require('../../fixtures');

// public/js/init.js runs on every page (views/templates/javascript_and_css_links.ejs). It:
// - adds a #modal div when the page has none, before the later scripts' ready callbacks
//   look for it (datepicker.js, modal-image-result.js);
// - cancels clicks on the a.blockUrl links present when the page is ready;
// - replaces #loading-section with the partial its #loading-form points to, running the
//   partial's inline scripts, then posts the section's onloadmessage;
// - adds a hidden trackingId input to the search forms submitted on the page.
// The jsdom tests in __tests__/public-js/init.test.js cover each case; these check them in
// real browsers, on real pages and on a fixture page served at a made-up same-origin path.

const FIXTURE_PATH = '/__e2e__/init-fixture';
const PARTIAL_PATH = '/__e2e__/init-partial';
const REDIRECTED_PATH = '/__e2e__/init-redirected';

// Fields that a form submission does and does not send, and values that need encoding.
const LOADING_FORM_FIELDS = `
<input type="hidden" name="q" value="a b&amp;c=d+e%f/g?h#i*j.k-l_m">
<input type="hidden" name="accents" value="ação €">
<input type="text" name="text" value="typed">
<input type="hidden" name="" value="no name">
<input type="hidden" name="disabled" value="x" disabled>
<input type="checkbox" name="unchecked" value="x">
<input type="checkbox" name="checked" value="yes" checked>
<input type="checkbox" name="checked-no-value" checked>
<input type="radio" name="radio" value="r1">
<input type="radio" name="radio" value="r2" checked>
<select name="single"><option value="s1">S1</option><option selected>s 2</option></select>
<select name="multi" multiple>
  <option value="m1" selected>M1</option><option value="m2">M2</option><option value="m3" selected>M3</option>
  <option value="m4" selected disabled>M4</option>
</select>
<textarea name="area">one line</textarea>
<input type="file" name="file">
<input type="submit" name="submit" value="Submit">
<input type="image" name="image" alt="go">
<input type="reset" name="reset" value="Reset">
<button type="submit" name="button-element" value="b">B</button>`;

const FIXTURE = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<script src="/vendor/js/jquery-1.12.4.js"></script>
<script src="/js/init.js"></script>
<script>
  // Like datepicker.js and modal-image-result.js, which keep $('#modal') from their $(fn).
  window.seenModal = [];
  $(function () { seenModal.push(['$(fn)', !!document.getElementById('modal')]); });
  document.addEventListener('DOMContentLoaded', function () {
    seenModal.push(['DOMContentLoaded', !!document.getElementById('modal')]);
  });
  window.messages = [];
  window.addEventListener('message', function (e) {
    messages.push({ data: e.data, loaded: !!document.getElementById('loaded'), runs: window.partialRuns });
  });
</script>
</head><body>
<a id="blocked" class="blockUrl" href="#blocked">blocked</a>
<nav id="nav">
  <section id="loading-section" onloadmessage="fixture">
    <form id="loading-form" action="${PARTIAL_PATH}">${LOADING_FORM_FIELDS}</form>
  </section>
  <footer id="after"></footer>
</nav>
<script>window.jQuerySerialized = $('#loading-form').serialize();</script>
</body></html>`;

const PARTIAL = `<section id="loaded"><button class="accordion">2020</button></section>
<script>
  window.partialRuns = (window.partialRuns || 0) + 1;
  window.partialSawContent = !!document.querySelector('#loaded .accordion');
</script>`;

function collectPageErrors(page) {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    return errors;
}

test.describe('fixture page', () => {
    let partialRequests;

    test.beforeEach(async ({ page }) => {
        partialRequests = [];
        await page.route(`**${FIXTURE_PATH}`, (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: FIXTURE }));
        await page.route(`**${PARTIAL_PATH}?*`, (route) => {
            partialRequests.push(route.request());
            return route.fulfill({ contentType: 'text/html; charset=utf-8', body: PARTIAL });
        });
    });

    test('requests the partial with the fields jQuery serialized, runs its scripts once, then posts the message', async ({ page }) => {
        const errors = collectPageErrors(page);
        await page.goto(FIXTURE_PATH);
        await expect(page.locator('#loaded')).toBeVisible();
        await expect.poll(() => page.evaluate(() => window.messages.length)).toBe(1);

        expect(partialRequests).toHaveLength(1);
        const request = partialRequests[0];
        const jQuerySerialized = await page.evaluate(() => window.jQuerySerialized);
        const url = new URL(request.url());
        expect(url.pathname).toBe(PARTIAL_PATH);
        expect(url.search).toBe(`?${jQuerySerialized}`);
        expect(jQuerySerialized).toBe([
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
        ].join('&'));
        expect(request.method()).toBe('GET');
        expect(await request.headerValue('x-requested-with')).toBe('XMLHttpRequest');

        const state = await page.evaluate(() => ({
            partialRuns: window.partialRuns,
            partialSawContent: window.partialSawContent,
            messages: window.messages,
            loadingSection: !!document.getElementById('loading-section'),
            nav: Array.from(document.getElementById('nav').children, (el) => el.id || el.tagName),
        }));
        expect(state).toEqual({
            partialRuns: 1,
            partialSawContent: true,
            messages: [{ data: { arquivo_type: 'section-loaded', message: 'fixture' }, loaded: true, runs: 1 }],
            loadingSection: false,
            nav: ['loaded', 'SCRIPT', 'after'],
        });
        expect(errors).toEqual([]);
    });

    test('creates #modal before the later ready callbacks, and cancels a.blockUrl clicks', async ({ page }) => {
        const errors = collectPageErrors(page);
        await page.goto(FIXTURE_PATH);

        expect(await page.evaluate(() => window.seenModal)).toEqual([['$(fn)', true], ['DOMContentLoaded', true]]);
        await expect(page.locator('body > #modal:last-child')).toHaveAttribute('onclick', 'closeReplayRightMenuNav()');

        await page.locator('#blocked').click();
        expect(new URL(page.url()).hash).toBe('');
        expect(errors).toEqual([]);
    });

    test('does not run a module script of the partial, as jQuery did not', async ({ page }) => {
        await page.unroute(`**${PARTIAL_PATH}?*`);
        await page.route(`**${PARTIAL_PATH}?*`, (route) => route.fulfill({
            contentType: 'text/html; charset=utf-8',
            body: `${PARTIAL}<script type="module">window.moduleRan = true;</script>`,
        }));
        const errors = collectPageErrors(page);
        await page.goto(FIXTURE_PATH);
        await expect.poll(() => page.evaluate(() => window.messages.length)).toBe(1);

        // An inline module script added now runs after any the partial could have queued.
        await page.evaluate(() => new Promise((resolve) => {
            window.moduleSentinel = resolve;
            const script = document.createElement('script');
            script.type = 'module';
            script.textContent = 'window.moduleSentinel();';
            document.body.append(script);
        }));
        expect(await page.evaluate(() => [window.partialRuns, window.moduleRan])).toEqual([1, undefined]);
        expect(errors).toEqual([]);
    });

    test('leaves the section in place when the partial fails', async ({ page }) => {
        await page.unroute(`**${PARTIAL_PATH}?*`);
        await page.route(`**${PARTIAL_PATH}?*`, (route) => route.fulfill({ status: 500, contentType: 'text/html; charset=utf-8', body: PARTIAL }));
        const errors = collectPageErrors(page);
        const response = page.waitForResponse((r) => r.url().includes(PARTIAL_PATH));
        await page.goto(FIXTURE_PATH);
        await response;

        await expect(page.locator('#loading-section')).toBeAttached();
        expect(await page.evaluate(() => [window.partialRuns, window.messages.length])).toEqual([undefined, 0]);
        expect(errors).toEqual([]);
    });

    test('leaves the section in place when the partial redirects', async ({ page, browserName }) => {
        test.skip(browserName === 'webkit', 'Playwright cannot fulfill a route with a redirect in WebKit');
        const redirected = [];
        await page.unroute(`**${PARTIAL_PATH}?*`);
        await page.route(`**${PARTIAL_PATH}?*`, (route) => route.fulfill({ status: 302, headers: { location: REDIRECTED_PATH } }));
        await page.route(`**${REDIRECTED_PATH}`, (route) => {
            redirected.push(route.request().url());
            return route.fulfill({ contentType: 'text/html; charset=utf-8', body: PARTIAL });
        });
        // Record how init.js's fetch settles: redirect: 'error' rejects it on the redirect.
        await page.addInitScript(() => {
            const fetch = window.fetch;
            window.fetch = (...args) => {
                const result = fetch(...args);
                window.fetchSettled = result.then(() => 'resolved', () => 'rejected');
                return result;
            };
        });
        await page.goto(FIXTURE_PATH);
        await page.waitForFunction(() => window.fetchSettled);

        expect(await page.evaluate(() => window.fetchSettled)).toBe('rejected');
        await expect(page.locator('#loading-section')).toBeAttached();
        expect(await page.evaluate(() => [window.partialRuns, window.messages.length])).toEqual([undefined, 0]);
        expect(redirected).toEqual([]);
    });
});

test('loads the page search results with the loading form\'s fields and the page\'s cookies', async ({ page, context, baseURL, browserName, pageSearchPage }) => {
    await context.addCookies([{ name: 'e2e', value: 'init', url: baseURL }]);
    // Runs before init.js's own DOMContentLoaded listener, while #loading-form is still there.
    await page.addInitScript(() => window.addEventListener('DOMContentLoaded', () => {
        window.jQuerySerialized = window.jQuery('#loading-form').serialize();
    }, { capture: true }));
    const errors = collectPageErrors(page);
    const partialRequest = page.waitForRequest((r) => new URL(r.url()).pathname === '/partials/pages-search-results');

    await pageSearchPage.goto('fccn (arquivo) "it\'s" ~ok!');
    const request = await partialRequest;
    await expect(pageSearchPage.results.first()).toBeVisible();

    // jQuery left !'()~ unencoded; the values the server reads are the same.
    const jQuerySerialized = await page.evaluate(() => window.jQuerySerialized);
    expect(Array.from(new URL(request.url()).searchParams)).toEqual(Array.from(new URLSearchParams(jQuerySerialized)));
    expect(new URL(request.url()).searchParams.get('q')).toBe('fccn (arquivo) "it\'s" ~ok!');
    expect(await request.headerValue('x-requested-with')).toBe('XMLHttpRequest');
    // Playwright's WebKit does not report the Cookie header of requests.
    if (browserName !== 'webkit') {
        expect(await request.headerValue('cookie')).toContain('e2e=init');
    }
    await expect(page.locator('#loading-section')).toHaveCount(0);
    expect(errors).toEqual([]);
});

test('runs the url search partial\'s accordion script once', async ({ page, urlSearchPage }) => {
    const errors = collectPageErrors(page);
    await urlSearchPage.goto('fccn.pt', { viewMode: 'list' });
    await expect(urlSearchPage.listContainer).toBeVisible();

    // The partial's inline script binds the accordion toggle: run twice, a click would toggle twice.
    const yearLink = page.locator('#list-results-year-2015 > a');
    await yearLink.click();
    await expect(yearLink).toHaveClass(/\bactive\b/);
    expect(errors).toEqual([]);
});

test('adds a trackingId to searches from the homepage', async ({ page, context, searchBar }) => {
    await searchBar.goto();
    await searchBar.search('fccn');
    await page.waitForURL(/\/page\/search\?/);

    const clientId = (await context.cookies()).find((c) => c.name === 'client_id').value;
    expect(new URL(page.url()).searchParams.get('trackingId')).toMatch(new RegExp(`^${clientId}_[0-9a-f]{20}$`));
});

test('adds a trackingId to the search forms of a loaded partial', async ({ page, urlSearchPage }) => {
    await urlSearchPage.goto('fccn.pt', { viewMode: 'list' });
    await page.locator('#replay-table-button').click();
    await page.waitForURL(/viewMode=table/);

    const params = new URL(page.url()).searchParams;
    expect(params.getAll('trackingId')).toHaveLength(1);
    expect(params.get('trackingId')).toMatch(/^[0-9a-f]{20}_[0-9a-f]{20}$/);
});
