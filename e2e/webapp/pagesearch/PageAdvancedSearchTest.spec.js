const { test, expect } = require('../../fixtures');
const { setDatePicker, searchThenOpenAdvancedSearch } = require('./helpers');

// Ported from docs/webapp/pagesearch/PageAdvancedSearchTest.md.
//
// Split into a mocked mechanics test (query-string/date-field rebuilding is
// pure server-side logic in src/utils/sanitize-search-params.js, reproducible
// regardless of backend content) and an @live test for the parts that
// depend on real result content (mock always returns mimeType 'text/html'
// for every result, and its fixed corpus never actually reflects the
// site: filter — see e2e/mock-server/fixtures.js).
//
// Note: the doc's code comments claim "31 may 2010"/"1 jan 2019" but the
// literal values passed are 31/05/2000 and 01/01/2010 — using the literal
// (actual) values here, per the doc's own note about this discrepancy.

test('combines date range, format and site filters into one query', async ({ page, searchBar, advancedSearchPage, isMobile }) => {
    test.skip(isMobile, 'mobile projects open the AnyPicker widget instead of #modal-datepicker-input; not driven by this spec');
    await searchThenOpenAdvancedSearch(searchBar, 'fccn');

    await expect.soft(advancedSearchPage.withWords).toHaveValue('fccn');

    await setDatePicker(page, 'start', '31/05/2000');
    await setDatePicker(page, 'end', '01/01/2010');

    await advancedSearchPage.formatCheckbox('all').uncheck();
    await advancedSearchPage.formatCheckbox('pdf').check();
    await advancedSearchPage.siteSearch.fill('www.fccn.pt');

    await advancedSearchPage.submit();

    await expect(searchBar.input).toHaveValue('fccn site:www.fccn.pt type:pdf');
    await expect.soft(page.locator('#start-date')).toHaveValue('20000531');
    await expect.soft(page.locator('#end-date')).toHaveValue('20100101');
});

test('shows only pdf results restricted to the chosen site @live', async ({ page, searchBar, advancedSearchPage, pageSearchPage, isMobile }) => {
    test.skip(isMobile, 'mobile projects open the AnyPicker widget instead of #modal-datepicker-input; not driven by this spec');
    await searchThenOpenAdvancedSearch(searchBar, 'fccn');

    await setDatePicker(page, 'start', '31/05/2000');
    await setDatePicker(page, 'end', '01/01/2010');

    await advancedSearchPage.formatCheckbox('all').uncheck();
    await advancedSearchPage.formatCheckbox('pdf').check();
    await advancedSearchPage.siteSearch.fill('www.fccn.pt');

    await advancedSearchPage.submit();
    await expect(pageSearchPage.results.first()).toBeVisible();

    const results = await pageSearchPage.results.all();
    for (const result of results) {
        await expect.soft(result.locator('.mime')).toContainText('[PDF]');
        await expect.soft(result).toContainText('fccn.pt');
    }
});
