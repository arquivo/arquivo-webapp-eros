const { test, expect } = require('../../fixtures');

/**
 * Ported from docs/webapp/imagesearch/ImageSearchQuerySuggestionTest.md.
 *
 * The image search API has no spellcheck, so the webapp asks the text search
 * API for one (`maxItems=0&fields=spellcheck`) in parallel with the image
 * search (see src/search-images.js). The mock server answers that with
 * 'lisboa' for its MISSPELLED_QUERY 'Lizboa' (e2e/mock-server/fixtures.js),
 * which is also a real misspelling on preprod, so this runs in both modes.
 */
test('suggests the correct spelling for a misspelled query', async ({ page, searchBar, imageSearchPage }) => {
    await searchBar.goto('pt');
    await searchBar.search('Lizboa');
    await searchBar.imagesTab.click();

    const link = page.locator('#term-suggested a');
    await expect(link).toContainText('lisboa');
    await expect(link).toHaveAttribute('href', /^\/image\/search\?q=lisboa&/);
});
