const { test, expect } = require('../../fixtures');

// Ported from docs/webapp/savepagenow/SavePageNowURLNotFoundTest.md.
//
// Tagged @live - a deliberate deviation from a fully-mocked port. Reasoning:
//
// The "no results, use ArchivePageNow" suggestion only renders on the
// URL-search not-found flow (views/partials/url-list-results.ejs and
// url-table-results.ejs both render body-not-found.ejs with
// `searchType: 'url-search'`). Its translation
// (translations/page-search.yml `url-search.second`) is the only one that
// mentions ArchivePageNow:
//   pt: 'Use o <a href="/services/archivepagenow?url=${url}">ArchivePageNow</a> para gravar a página em falta'
// The generic page-search not-found flow (views/partials/pages-search-results.ejs,
// `searchType: 'page-search'`) has its OWN, different "second" suggestion
// ("Pesquise outras palavras" / try more general words) with no
// ArchivePageNow mention at all. So a no-dot, non-URL-shaped query (which
// stays on /page/search) cannot exercise this scenario - only a URL-shaped
// query that the router redirects to /url/search (src/router.js
// `isValidUrl(q)` check) can.
//
// But e2e/mock-server/fixtures.js#buildCdxResults always returns a fixed
// 5-snapshot result for any url-search query, regardless of input - the
// mock server has no way to simulate a zero-result URL search, and per the
// porting instructions the mock server itself must not be edited. So the
// "not found" state this test is about can only be produced against real
// (live) archived content, where a nonsense domain genuinely has zero
// captures - hence @live, guarded by an explicit test.skip() in addition to
// the config's grep-based exclusion.
//
// Query kept from the legacy doc (`ddadfcfe.cdsffds`): it looks URL-shaped
// enough to satisfy both src/utils/is-valid-url.js (so /page/search
// redirects to /url/search, and the ArchivePageNow destination page
// pre-fills its search bar) while being extremely unlikely to have any real
// captures.
//
// The doc's alternate "SavePageNow" wording is retired - grepping
// src/+views/ shows only "ArchivePageNow" in any user-facing text.
const NO_RESULTS_URL_QUERY = 'ddadfcfe.cdsffds';

test('offers ArchivePageNow on a URL search with no results, and pre-fills the query on the destination page @live', async ({ page, searchBar, mode }) => {
    test.skip(mode !== 'live', 'Requires a real zero-result URL search; the mock CDX endpoint always returns a fixed 5-snapshot result.');

    await searchBar.goto('pt');
    await searchBar.search(NO_RESULTS_URL_QUERY); // /page/search redirects to /url/search since the query looks like a URL

    const noResults = page.locator('#no-results-were-found');
    await expect(noResults).toBeVisible();

    const suggestion = page.locator('#not-found-message ul li:nth-child(3)');
    await expect.soft(suggestion).toContainText('Use o ArchivePageNow para gravar a página em falta');

    await suggestion.locator('a').click();

    await expect.soft(page.locator('#submit-search-input')).toHaveValue(NO_RESULTS_URL_QUERY);
});
