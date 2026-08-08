const { test, expect } = require('../../fixtures');

// Ported from docs/webapp/workflow/WorkflowStateBetweenSearchPagesTest.md.
//
// Verifies that the search query and the date-range filter (from/to) survive
// next-page/previous-page navigation within the Pages search results.
//
// The legacy Selenium test drove a jQuery-UI date-range slider via a
// DatePicker helper before submitting the search. That widget isn't wrapped
// by any page object here (and none is being added for this port). Instead
// we seed the exact state the slider would have produced: per
// views/templates/fragments/search-tools-date-slider.ejs, #start-year /
// #start-day-month / #end-year / #end-day-month are rendered purely from the
// `from`/`to` query params on every request, and public/js/search-tools.js
// confirms `from`/`to` are themselves just the slider's #start-date/#end-date
// hidden inputs (format YYYYMMDD). So navigating directly with
// from=19970620&to=20140101 reproduces exactly what a user reaches by
// picking 20/06/1997 -> 01/01/2014 on the slider, without needing to drive
// the widget itself.
const QUERY = 'fccn';
const DATE_PARAMS = { from: '19970620', to: '20140101' };

async function expectStateIsPreserved(page, searchBar) {
    // "Check if fccn is in search box on second page" (message reused verbatim
    // in the legacy doc even when checking the previous page).
    await expect.soft(searchBar.input).toHaveValue(QUERY);
    // "Check if 1977 is in the year left datepicker" (copy-paste artifact in
    // the legacy doc's assertion message — the actual expected values are
    // 1997/20 Jun/2014/1 Jan).
    await expect.soft(page.locator('#start-year')).toHaveValue('1997');
    await expect.soft(page.locator('#start-day-month')).toHaveValue('20 Jun');
    await expect.soft(page.locator('#end-year')).toHaveValue('2014');
    await expect.soft(page.locator('#end-day-month')).toHaveValue('1 Jan');
}

test('preserves search query and date range across pages-search pagination', async ({ page, searchBar, pageSearchPage }) => {
    await pageSearchPage.goto(QUERY, { extraParams: DATE_PARAMS });
    await expect(pageSearchPage.results.first()).toBeVisible();

    await pageSearchPage.nextPageButton.click();
    await expect(pageSearchPage.results.first()).toBeVisible();
    await expectStateIsPreserved(page, searchBar);

    await pageSearchPage.previousPageButton.click();
    await expect(pageSearchPage.results.first()).toBeVisible();
    await expectStateIsPreserved(page, searchBar);

    // Doc's final extra check: an element carrying the raw query value
    // (targeted generically by its `value` attribute rather than by id).
    await expect.soft(page.locator('[value="fccn"]').first()).toBeVisible();
});
