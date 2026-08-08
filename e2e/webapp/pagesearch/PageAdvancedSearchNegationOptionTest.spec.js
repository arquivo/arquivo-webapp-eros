const { test, expect } = require('../../fixtures');
const { searchThenOpenAdvancedSearch } = require('./helpers');

// Ported from docs/webapp/pagesearch/PageAdvancedSearchNegationOptionTest.md.
//
// Split into a mocked mechanics test (rebuilt query string, plus a
// "results mention fccn" sanity check — meaningful because the mock's
// snippet echoes the final query text verbatim) and an @live test for
// whether negation actually filters results, since the mock never applies
// filters and its snippet also echoes back the negated term itself
// (`... -Fundação ...`), which would make a "no result contains Fundação"
// check fail against the mock regardless of real negation behavior.
//
// The @live check is written as a case-insensitive match: the legacy code
// lowercases the result text but then compares it against the literal
// capitalized "Fundação", making the original check effectively a
// case-sensitive (and thus close to a no-op) comparison — a likely latent
// bug, per the doc's notes. This port uses the evidently-intended
// case-insensitive check instead.

test('excludes a term from the query via the "without these words" field', async ({ searchBar, advancedSearchPage, pageSearchPage }) => {
    await searchThenOpenAdvancedSearch(searchBar, 'fccn');

    await expect.soft(advancedSearchPage.withWords).toHaveValue('fccn');

    await advancedSearchPage.withoutWords.fill('Fundação');
    await advancedSearchPage.submit();

    await expect.soft(searchBar.input).toHaveValue('fccn -Fundação');

    // Hard assertion in the legacy suite (plain assertEquals, not appendError).
    await expect(pageSearchPage.results.filter({ hasText: /fccn/i }).first()).toBeVisible();
});

test('does not show results mentioning the excluded term @live', async ({ searchBar, advancedSearchPage, pageSearchPage }) => {
    await searchThenOpenAdvancedSearch(searchBar, 'fccn');

    await advancedSearchPage.withoutWords.fill('Fundação');
    await advancedSearchPage.submit();

    await expect(pageSearchPage.results.first()).toBeVisible();

    const matchingCount = await pageSearchPage.results.filter({ hasText: /Fundação/i }).count();
    expect.soft(matchingCount).toBe(0);
});
