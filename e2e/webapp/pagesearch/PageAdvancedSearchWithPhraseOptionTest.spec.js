const { test, expect } = require('../../fixtures');
const { searchThenOpenAdvancedSearch } = require('./helpers');

// Ported from docs/webapp/pagesearch/PageAdvancedSearchWithPhraseOptionTest.md.
//
// Split into a mocked mechanics test (rebuilt query string, plus a
// "results mention fccn" sanity check — meaningful because the mock's
// snippet echoes the final query text verbatim) and an @live test for the
// exact-phrase-in-results check, since the mock's snippet only ever echoes
// back the raw rebuilt query text (`... fccn "speedmeter" ...`, quoted and
// in the opposite order) rather than the real phrase "speedmeter fccn" the
// doc expects from actual archive content.
//
// The doc's assertion message for the query-string check ("Verify if the -
// operator is on text box") is copy-pasted from the negation test and is
// misleading here since this checks quoting, not the `-` operator — worded
// correctly below, per the doc's own note.

test('wraps the phrase field value in quotes in the rebuilt query', async ({ searchBar, advancedSearchPage, pageSearchPage }) => {
    await searchThenOpenAdvancedSearch(searchBar, 'fccn');

    await expect.soft(advancedSearchPage.withWords).toHaveValue('fccn');

    await advancedSearchPage.withPhrase.fill('speedmeter');
    await advancedSearchPage.submit();

    await expect.soft(searchBar.input).toHaveValue('fccn "speedmeter"');

    // Hard assertion in the legacy suite (plain assertEquals, not appendError).
    await expect(pageSearchPage.results.filter({ hasText: /fccn/i }).first()).toBeVisible();
});

test('shows the exact phrase alongside the search term in results @live', async ({ searchBar, advancedSearchPage, pageSearchPage }) => {
    await searchThenOpenAdvancedSearch(searchBar, 'fccn');

    await advancedSearchPage.withPhrase.fill('speedmeter');
    await advancedSearchPage.submit();

    await expect(pageSearchPage.results.first()).toBeVisible();

    // Hard assertion in the legacy suite (plain assertEquals, not appendError).
    await expect(pageSearchPage.results.filter({ hasText: 'speedmeter fccn' }).first()).toBeVisible();
});
