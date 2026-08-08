const { test, expect } = require('../../fixtures');

// Ported from docs/webapp/workflow/WorkflowStateBetweenSearchPageAndImageTest.md.
//
// Verifies that the search query and the date-range filter (from/to) survive
// switching between the "Images" and "Pages" search tabs (as opposed to the
// sibling workflow specs, which check persistence across pagination within a
// single search type).
//
// public/js/search-tools.js intercepts submission of `form.search-type`
// (the Pages/Images/Advanced tab buttons) and injects fresh hidden q/from/to
// inputs read live from #submit-search-input/#start-date/#end-date before
// letting the form submit — so clicking a tab always carries over whatever
// state is currently in the DOM. We seed that initial state via `from`/`to`
// query params (see WorkflowStateBetweenSearchPagesTest.spec.js for why),
// then use the real tab buttons (searchBar.imagesTab/pagesTab) to switch
// types and confirm state follows.
const QUERY = 'fccn';
const DATE_PARAMS = { from: '19970620', to: '20140101' };

async function expectStateIsPreserved(page, searchBar) {
    // "Check if fccn is in search box on image search" (message reused
    // verbatim in the legacy doc for both the images and pages views).
    await expect.soft(searchBar.input).toHaveValue(QUERY);
    // "Check if 1977 is in the year left datepicker" (copy-paste artifact in
    // the legacy doc's assertion message — the actual expected values are
    // 1997/20 Jun/2014/1 Jan).
    await expect.soft(page.locator('#start-year')).toHaveValue('1997');
    await expect.soft(page.locator('#start-day-month')).toHaveValue('20 Jun');
    await expect.soft(page.locator('#end-year')).toHaveValue('2014');
    await expect.soft(page.locator('#end-day-month')).toHaveValue('1 Jan');
}

test('preserves search query and date range when switching between images and pages search', async ({ page, searchBar, pageSearchPage, imageSearchPage }) => {
    await pageSearchPage.goto(QUERY, { extraParams: DATE_PARAMS });
    await expect(pageSearchPage.results.first()).toBeVisible();

    await searchBar.imagesTab.click();
    await expect(imageSearchPage.results.first()).toBeVisible();
    await expectStateIsPreserved(page, searchBar);

    await searchBar.pagesTab.click();
    await expect(pageSearchPage.results.first()).toBeVisible();
    await expectStateIsPreserved(page, searchBar);
});
