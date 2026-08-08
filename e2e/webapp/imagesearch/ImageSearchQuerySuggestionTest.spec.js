const { test, expect } = require('../../fixtures');

/**
 * Ported from docs/webapp/imagesearch/ImageSearchQuerySuggestionTest.md.
 *
 * Query-suggestion text comes from a real, external suggestion backend
 * (src/apis/suggestion-api.js hits `config.get('query.suggestion.api')` and
 * scrapes a `<div id="correction"><em>...</em></div>` out of real HTML) that
 * the mock server (e2e/mock-server/) does not stub, so this only makes sense
 * as a live spec against real preprod content.
 */
test('suggests the correct spelling for a misspelled query @live', async ({ page, searchBar, imageSearchPage }) => {
    await searchBar.goto('pt');
    await searchBar.search('amazoncouk');
    await searchBar.imagesTab.click();

    await expect(page.locator('#term-suggested a')).toContainText('amazon.co.uk');
});
