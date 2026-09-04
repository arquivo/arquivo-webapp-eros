const { test, expect } = require('../../fixtures');

// Ported from docs/webapp/datepicker/DatePickerTest.md.
//
// The legacy `pt.arquivo.utils.DatePicker` had two completely different
// implementations depending on platform (public/js/datepicker.js `isMobile()`
// check, based on user-agent/viewport width):
// - Desktop: clicking the year field (`.call-datepicker-<type>-year`, e.g.
//   `#start-year`/`#end-year`) opens a modal text input
//   (`#modal-datepicker-input`) with an inputmask in `dd/mm/yyyy` format;
//   typing the date and pressing Enter (or clicking
//   `#modal-datepicker-confirm-button`) commits it.
// - Mobile: the same click instead opens an AnyPicker wheel-style widget,
//   never a text input.
// This spec only drives the desktop modal flow; it assumes a desktop-sized
// project (chromium/firefox/webkit) rather than the mobile-emulation
// projects (Mobile Chrome/Mobile Safari) configured in playwright.config.js,
// where clicking the year field would open the (untested here) AnyPicker
// widget instead. Per the porting guidance this isn't special-cased in the
// spec itself.
//
// The committed date is read back from the hidden `#start-date`/`#end-date`
// inputs (raw `yyyyMMdd`, set by `updateDateSlider` in datepicker.js) and
// reformatted to `dd/MM/yyyy` for comparison, mirroring
// `DatePicker.getDateString` in the legacy suite.

const START_DATE = '31/05/2010';
const END_DATE = '01/01/2012';

function toDisplayFormat(yyyymmdd) {
    return `${yyyymmdd.slice(6, 8)}/${yyyymmdd.slice(4, 6)}/${yyyymmdd.slice(0, 4)}`;
}

async function setDatePicker(page, type, dateString) {
    await page.locator(`#${type}-year`).click();
    const modalInput = page.locator('#modal-datepicker-input');
    await expect(modalInput).toBeVisible();
    await modalInput.click();
    await modalInput.press('Home');
    await modalInput.pressSequentially(dateString);
    await modalInput.press('Enter');
    await expect(modalInput).toBeHidden();
}

test('sets the start and end date pickers and reflects the chosen dates', async ({ page, searchBar, isMobile }) => {
    test.skip(isMobile, 'mobile projects open the AnyPicker widget instead of #modal-datepicker-input; not driven by this spec');
    await searchBar.goto('pt');

    await setDatePicker(page, 'start', START_DATE);
    await setDatePicker(page, 'end', END_DATE);

    const startValue = await page.locator('#start-date').inputValue();
    const endValue = await page.locator('#end-date').inputValue();

    // Both hard assertions in the legacy JUnit test (plain assertEquals,
    // not appendError) - keep them as hard `expect`s here too.
    expect(toDisplayFormat(startValue)).toBe(START_DATE);
    expect(toDisplayFormat(endValue)).toBe(END_DATE);
});
