/**
 * Shared helpers for e2e/webapp/pagesearch specs.
 *
 * setDatePicker drives the real homepage/advanced-search date-picker widget
 * (public/js/datepicker.js): clicking the year field (`#start-year`/
 * `#end-year`) opens a modal (its markup is AJAX-loaded from
 * /partials/modal-datepicker into the global `#modal` div bootstrapped by
 * public/js/init.js) containing a masked free-text date input
 * (`#modal-datepicker-input`, dd/mm/yyyy); typing the date and pressing
 * Enter commits it into the hidden `#start-date`/`#end-date` inputs
 * (yyyymmdd). This mirrors the convention already used by
 * e2e/webapp/datepicker/DatePickerTest.spec.js. Only the desktop modal flow
 * is exercised here — on the Mobile Chrome/Safari projects, `isMobile()`
 * (public/js/functions.js) makes the same click open a different AnyPicker
 * scroll-wheel widget instead, which isn't driven by this helper (per that
 * spec's note, this isn't special-cased here either).
 */

async function setDatePicker(page, type, ddmmyyyy) {
    await page.locator(`#${type}-year`).click();
    const modalInput = page.locator('#modal-datepicker-input');
    await modalInput.waitFor({ state: 'visible' });
    await modalInput.click();
    await modalInput.press('Home');
    await modalInput.pressSequentially(ddmmyyyy);
    await modalInput.press('Enter');
    await modalInput.waitFor({ state: 'hidden' });
}

async function getDate(page, type) {
    // #start-date/#end-date are hidden inputs storing the date as yyyymmdd.
    return page.locator(`#${type}-date`).inputValue();
}

// Shared preamble for the PageAdvancedSearch* docs: search for a term from
// the homepage, then follow the "Advanced Search" tab. The advanced search
// form's `words` field ends up pre-filled with the search term because
// src/utils/sanitize-search-params.js converts an incoming `q` into
// `adv_and` (and splits out phrase/negation/site/type/collection operators)
// server-side when the advanced search page is requested with `q` set.
async function searchThenOpenAdvancedSearch(searchBar, query = 'fccn') {
    await searchBar.goto();
    await searchBar.search(query);
    await searchBar.advancedTab.click();
}

module.exports = { setDatePicker, getDate, searchThenOpenAdvancedSearch };
