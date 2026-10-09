const { test, expect } = require('../../fixtures');

// Ported from docs/webapp/pagesearch/PageSearchQuerySuggestionTest.md.
//
// The "did you mean" suggestion comes from the text search API itself: the
// page search request asks for `fields=spellcheck` and the reply carries the
// corrected query in `suggested_query` (see withSpellcheck/getSuggestion in
// src/apis/page-search-api.js). The mock server mirrors this for its
// MISSPELLED_QUERY ('Lizboa' -> 'lisboa', see e2e/mock-server/fixtures.js),
// which is also a real misspelling on preprod, so this runs in both modes.
test('suggests the corrected spelling for a misspelled query', async ({ pageSearchPage, page }) => {
    await pageSearchPage.goto('Lizboa');

    const suggestion = page.locator('#term-suggested');

    await expect(suggestion).toContainText('Será que quis dizer: lisboa');
});

test('links the suggestion to the corrected search, starting on its first page', async ({ pageSearchPage, page }) => {
    await pageSearchPage.goto('Lizboa', { extraParams: { offset: '10' } });

    const link = page.locator('#term-suggested a');
    const href = await link.getAttribute('href');

    // A real URL (not javascript:), so hovering shows where it goes and it can be opened in a new tab
    expect(href).toMatch(/^\/page\/search\?/);
    const params = new URL(href, 'http://localhost').searchParams;
    expect(params.get('q')).toBe('lisboa');
    expect(params.get('spellchecked')).toBe('true');
    expect(params.has('offset')).toBe(false);
    expect(params.has('adv_and')).toBe(false);

    await link.click();
    await expect(page).toHaveURL(/\/page\/search\?q=lisboa&/);
    await expect(page.locator('#term-suggested')).toHaveCount(0);
});

test('keeps inline search terms such as collection: in the suggested search', async ({ pageSearchPage, page }) => {
    await pageSearchPage.goto('Lizboa collection:Roteiro');

    const link = page.locator('#term-suggested a');
    await expect(link).toHaveText('lisboa collection:Roteiro');

    await link.click();
    await expect(page.locator('#submit-search-input')).toHaveValue('lisboa collection:Roteiro');
});

test('does not suggest anything for a correctly spelled query', async ({ pageSearchPage, page }) => {
    await pageSearchPage.goto('lisboa');

    await expect(page.locator('#term-suggested')).toHaveCount(0);
});
