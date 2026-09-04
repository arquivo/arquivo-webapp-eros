const { test, expect } = require('../../fixtures');
const { searchThenOpenAdvancedSearch } = require('./helpers');

// Ported from docs/webapp/pagesearch/PageAdvancedSearchMimeTypeTest.md.
//
// Split into a mocked mechanics test (the rebuilt search-box query string,
// plus a "results mention fccn" sanity check — the mock's snippet echoes
// the final query text verbatim, see e2e/mock-server/fixtures.js
// buildPageResponseItem, so this is a meaningful check that the rebuilt
// query actually reached the backend) and an @live test for the mime-label
// check, since every mocked result has mimeType 'text/html' regardless of
// the type:pdf filter (mock doesn't apply filters).

test('restricts the query to pdf via the advanced search form', async ({ searchBar, advancedSearchPage, pageSearchPage }) => {
    await searchThenOpenAdvancedSearch(searchBar, 'fccn');

    await expect.soft(advancedSearchPage.withWords).toHaveValue('fccn');

    await advancedSearchPage.formatCheckbox('all').uncheck();
    await advancedSearchPage.formatCheckbox('pdf').check();
    await advancedSearchPage.submit();

    await expect.soft(searchBar.input).toHaveValue('fccn type:pdf');

    // Hard assertion in the legacy suite (plain assertTrue, not appendError).
    await expect(pageSearchPage.results.filter({ hasText: /fccn/i }).first()).toBeVisible();
});

test('shows only pdf-mimetype results after filtering by format @live', async ({ searchBar, advancedSearchPage, pageSearchPage }) => {
    await searchThenOpenAdvancedSearch(searchBar, 'fccn');

    await advancedSearchPage.formatCheckbox('all').uncheck();
    await advancedSearchPage.formatCheckbox('pdf').check();
    await advancedSearchPage.submit();

    await expect(pageSearchPage.results.first()).toBeVisible();

    const firstResultMime = pageSearchPage.result(0).locator('.mime');
    await expect.soft(firstResultMime).toHaveText('[PDF]');
});
