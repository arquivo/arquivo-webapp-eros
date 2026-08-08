const { test, expect } = require('../../fixtures');

// Ported from docs/webapp/workflow/WorkflowStateBetweenSearchImagesTest.md.
//
// Verifies that the search query and the date-range filter (from/to) survive
// next-page/previous-page navigation within the Images search results.
//
// See WorkflowStateBetweenSearchPagesTest.spec.js for why the date range is
// seeded via `from`/`to` query params instead of driving the (unwrapped)
// date-slider widget directly.
const QUERY = 'fccn';
const DATE_PARAMS = { from: '19970620', to: '20140101' };

async function expectStateIsPreserved(page, searchBar) {
    await expect.soft(searchBar.input).toHaveValue(QUERY);
    // "Check if 1977 is in the year left datepicker" (copy-paste artifact in
    // the legacy doc's assertion message — the actual expected values are
    // 1997/20 Jun/2014/1 Jan).
    await expect.soft(page.locator('#start-year')).toHaveValue('1997');
    await expect.soft(page.locator('#start-day-month')).toHaveValue('20 Jun');
    await expect.soft(page.locator('#end-year')).toHaveValue('2014');
    await expect.soft(page.locator('#end-day-month')).toHaveValue('1 Jan');
}

test('preserves search query and date range across images-search pagination', async ({ page, searchBar, imageSearchPage }) => {
    await imageSearchPage.goto(QUERY, { extraParams: DATE_PARAMS });
    await expect(imageSearchPage.results.first()).toBeVisible();

    await imageSearchPage.nextPageButton.click();
    await expect(imageSearchPage.results.first()).toBeVisible();
    await expectStateIsPreserved(page, searchBar);

    await imageSearchPage.previousPageButton.click();
    await expect(imageSearchPage.results.first()).toBeVisible();
    await expectStateIsPreserved(page, searchBar);
});
