const { test, expect } = require('../../fixtures');
const { setDatePicker, getDate } = require('./helpers');

// Ported from docs/webapp/pagesearch/PageSearchOverlapDatesTest.md.
//
// Purely a client-side date-picker widget check (no search is ever
// submitted, per the doc's notes), so it needs no backend/mock data at all
// and isn't tagged @live.
//
// Note: inspecting public/js/datepicker.js, the modal's free-text date
// input (#modal-datepicker-input) and its confirm/Enter handling
// (`submitDate`) don't cross-validate the typed value against the other
// end of the range — only the jQuery UI calendar view constrains selectable
// days via minDate/maxDate. So typing an inverted range through the text
// input (as this spec does, for consistency with the other date-picker
// specs) may not actually get corrected by the current widget; this test
// faithfully ports the doc's invariant check regardless; a failure here
// would be a genuine finding about current widget behavior rather than a
// scripting bug.
test('does not allow an inverted date range to persist after entering overlapping dates', async ({ page, searchBar, isMobile }) => {
    test.skip(isMobile, 'mobile projects open the AnyPicker widget instead of #modal-datepicker-input; not driven by this spec');
    await searchBar.goto();
    await searchBar.input.fill('fccn');

    await setDatePicker(page, 'start', '20/05/1997');
    await setDatePicker(page, 'end', '22/08/1996');

    const startDate = await getDate(page, 'start');
    const endDate = await getDate(page, 'end');

    // yyyymmdd strings compare correctly lexicographically.
    expect.soft(startDate <= endDate).toBe(true);
});
