const { test, expect } = require('../../fixtures');

/**
 * Ported from docs/webapp/imagesearch/ImageAdvancedSearchTest.md.
 *
 * The legacy Java/Selenium doc drives the advanced-search date range via a
 * `pt.arquivo.utils.DatePicker` helper. The current UI's equivalent is the
 * modal date-picker opened by clicking the readonly `#start-year`/`#end-year`
 * fields (see public/js/datepicker.js + views/partials/modal-datepicker.ejs):
 * click the year field -> a modal opens with a masked `dd/mm/yyyy` text input
 * (#modal-datepicker-input) -> type the date -> click #modal-datepicker-confirm-button.
 * That JS then fills the hidden from/to inputs and the readonly
 * #start-day-month/#start-year/#end-day-month/#end-year display fields using
 * jQuery UI datepicker's own localized month abbreviations (translations/libs.yml
 * libs.jQuery.datepicker.monthNamesShort.pt = [Jan,Fev,Mar,Abr,Mai,...]), which is
 * how the doc's expected "31 Mai" / "1 Jan" values are produced.
 */
async function setDateViaModal(page, type, ddmmyyyy) {
    await page.locator(`#${type}-year`).click();
    const modalInput = page.locator('#modal-datepicker-input');
    await expect(modalInput).toBeVisible();
    // Don't click the input before typing: opening the modal already
    // focuses it with the cursor at position 0 (datepicker.js's
    // `.select()` + `setSelectionRange(0, 0)`). An extra click lands the
    // cursor mid-text (over the pre-filled default date), which misaligns
    // the masked input and silently drops the day/month digits.
    await modalInput.pressSequentially(ddmmyyyy);
    await page.locator('#modal-datepicker-confirm-button').click();
    await expect(page.locator('#modal-datepicker-container')).toBeHidden();
}

async function fillAdvancedImageSearchForm(page, advancedSearchPage) {
    await advancedSearchPage.gotoImages('pt');
    await page.waitForLoadState('networkidle');

    // "Check if search words maintain fccn term"
    await advancedSearchPage.withWords.fill('fccn');
    await expect.soft(advancedSearchPage.withWords).toHaveValue('fccn');

    await setDateViaModal(page, 'start', '31/05/2010');
    await setDateViaModal(page, 'end', '01/01/2012');

    // "Select size to small images"
    await page.locator('#image-size').selectOption('sm');

    // "Unselect 'All formats'" / "Set format type to 'PNG'"
    await advancedSearchPage.formatCheckbox('all').uncheck();
    await advancedSearchPage.formatCheckbox('png').check();

    // "Set site"
    await advancedSearchPage.siteSearch.fill('fccn.pt');

    // "Click on search on arquivo.pt button"
    await advancedSearchPage.submit();
}

test('applies date range, size, format and site filters from the advanced image search form', async ({ page, advancedSearchPage, searchBar, imageSearchPage, isMobile }) => {
    test.skip(isMobile, 'mobile projects open the AnyPicker widget instead of #modal-datepicker-input; not driven by this spec');
    await fillAdvancedImageSearchForm(page, advancedSearchPage);

    // Mocked corpus is deterministic regardless of query/filters, so we can
    // assert on the filter *mechanics* (URL/search-box/date re-population)
    // without depending on real crawl content.
    await expect.soft(imageSearchPage.results.first()).toBeVisible();

    // "After advanced search check search term contains"
    await expect.soft(searchBar.input).toHaveValue('fccn site:fccn.pt size:sm type:png');

    // "After advanced search check day/year start/end date contains"
    await expect.soft(page.locator('#start-day-month')).toHaveValue('31 Mai');
    await expect.soft(page.locator('#start-year')).toHaveValue('2010');
    await expect.soft(page.locator('#end-day-month')).toHaveValue('1 Jan');
    await expect.soft(page.locator('#end-year')).toHaveValue('2012');
});

test('shows the real fccn.pt 2011 capture for the advanced-search filters @live', async ({ page, advancedSearchPage, imageSearchPage, isMobile }) => {
    test.skip(isMobile, 'mobile projects open the AnyPicker widget instead of #modal-datepicker-input; not driven by this spec');
    await fillAdvancedImageSearchForm(page, advancedSearchPage);

    const firstResult = imageSearchPage.result(0);
    await expect(firstResult).toBeVisible();

    // "Check image original origin/domain"
    await expect.soft(firstResult.locator('.results-url')).toContainText('fccn.pt');
    // "Check image date"
    await expect.soft(firstResult.locator('.results-date')).toHaveText('20 Janeiro 2011');
    // "Check image src"
    await expect.soft(firstResult.locator('a.results-image img')).toHaveAttribute(
        'src',
        /wayback\/20110120225358im_\/http:\/\/fccn\.pt\/images\/announce\/modulo_moodle_04109\.jpg$/
    );
});
