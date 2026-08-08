const { test, expect } = require('../../fixtures');
const { setDatePicker } = require('./helpers');

// Ported from docs/webapp/pagesearch/PageSearchLimitedDatesFromHomepageTest.md.
//
// The estimated-results message only depends on the from/to values echoed
// back by the (mock or real) API, so restricting the search to 1996-1997
// via the homepage date pickers and checking the message wording is fully
// reproducible under the mock and kept as a mocked test.
//
// The doc's other checks (first result's URL/tstamp/title/summary) are tied
// to one specific, real archived capture of fccn.pt (tstamp
// 19961013145650, "Av. Brasil" in the summary) which the mock's fixed,
// unrelated (example.com) corpus can't reproduce — kept as @live, written
// against the doc's real expected values.

test('restricts results to a date range entered on the homepage', async ({ page, searchBar, pageSearchPage, isMobile }) => {
    test.skip(isMobile, 'mobile projects open the AnyPicker widget instead of #modal-datepicker-input; not driven by this spec');
    await searchBar.goto();
    await searchBar.input.fill('fccn');

    await setDatePicker(page, 'start', '12/10/1996');
    await setDatePicker(page, 'end', '01/01/1997');

    await searchBar.submitButton.click();
    await expect(pageSearchPage.estimatedResults).toBeVisible();

    const text = await pageSearchPage.estimatedResults.textContent();
    expect.soft(text).toContain('Cerca de ');
    expect.soft(text).toContain('resultados desde 1996 até 1997');
});

test('shows the known fccn.pt capture for a homepage date-restricted search @live', async ({ page, searchBar, pageSearchPage, isMobile }) => {
    test.skip(isMobile, 'mobile projects open the AnyPicker widget instead of #modal-datepicker-input; not driven by this spec');
    await searchBar.goto();
    await searchBar.input.fill('fccn');

    await setDatePicker(page, 'start', '12/10/1996');
    await setDatePicker(page, 'end', '01/01/1997');

    await searchBar.submitButton.click();
    await expect(pageSearchPage.estimatedResults).toBeVisible();

    const text = await pageSearchPage.estimatedResults.textContent();
    expect.soft(text).toContain('Cerca de ');
    expect.soft(text).toContain('resultados desde 1996 até 1997');

    const firstResult = pageSearchPage.result(0);
    await expect.soft(firstResult).toBeVisible();
    await expect.soft(firstResult).toContainText('fccn.pt');
    await expect.soft(firstResult).toHaveAttribute('data-tstamp', '19961013145650');
    await expect.soft(firstResult).toHaveAttribute('data-url', /fccn\.pt/);

    const version = firstResult.locator('.results-date');
    await expect.soft(version).toContainText('13 Outubro 1996');

    const summary = firstResult.locator('.results-summary');
    await expect.soft(summary).toContainText('Av. Brasil');
});
