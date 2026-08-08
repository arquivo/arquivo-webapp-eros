const { test, expect } = require('../../../fixtures');

// Ported from docs/webapp/replay/options/ReplayListVersionsTest.md.
//
// The legacy doc's `#replayMenuButton` and swiper-based selectors are stale.
// Current selector: replayOptionsMenu.listVersionsLink (#menuListVersions,
// href="/page/search?q=<requestedPage.url>" per
// views/templates/menu/replay_right_nav_menu.ejs). Its click handler
// (public/js/replay.js) does `e.preventDefault(); window.location =
// e.target.href` — i.e. it navigates to the *same* href already exposed on
// the anchor, unlike the legacy doc, which described two different
// hrefs/destinations for the "read href" step vs. the "click" step.
//
// `/page/search` (src/router.js) redirects to `/url/search` whenever `q`
// looks like a URL (src/utils/is-valid-url.js) — which it does here —
// adding default `from`/`to` params via src/utils/sanitize-search-params.js:
// `from` is always `config.get('search.start.date')` (19910806, matching
// the legacy doc's hardcoded value); `to` is *today's full date*
// (YYYYMMDD), not just the current year as in the legacy doc (the app now
// stamps the actual current date rather than only Calendar.YEAR) — computed
// dynamically below so this test doesn't need updating every year.
const WAYBACK_TIMESTAMP = '19961013145650';
const WAYBACK_SITE = 'http://www.fccn.pt/';
const WAYBACK_EXAMPLE = `/wayback/${WAYBACK_TIMESTAMP}/${WAYBACK_SITE}`;

test('list-versions link points to and navigates to a URL search for the archived page', async ({ page, replayOptionsMenu }) => {
    await page.goto(WAYBACK_EXAMPLE);

    await replayOptionsMenu.open();

    const href = await replayOptionsMenu.listVersionsLink.getAttribute('href');
    expect.soft(href).toContain('/page/search');
    expect.soft(href).toContain(WAYBACK_SITE);

    await replayOptionsMenu.listVersionsLink.click();

    // Hard: the click must actually land on the URL-search redirect target.
    await expect(page).toHaveURL(/\/url\/search\?/, { timeout: 20000 });

    const resultUrl = new URL(page.url());
    const expectedTo = new Date().toLocaleDateString('en-CA').split('-').join('');
    expect.soft(resultUrl.searchParams.get('q')).toBe(WAYBACK_SITE);
    expect.soft(resultUrl.searchParams.get('from')).toBe('19910806');
    expect.soft(resultUrl.searchParams.get('to')).toBe(expectedTo);
});
