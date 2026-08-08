const { test, expect } = require('../../fixtures');

// Ported from docs/webapp/pagesearch/PageSearchQuerySuggestionTest.md.
//
// The "did you mean" suggestion comes from SuggestionApiRequest
// (src/apis/suggestion-api.js), which is disabled by default
// (`query.suggestion.api_enabled = false` in config/default.properties) and
// falls back to echoing the original query back unchanged whenever it's
// disabled, times out, or the response doesn't match the expected
// `<div id="correction"><em>...</em></div>` shape — all of which apply in
// mocked mode (the mock server has no handler for the spellchecker
// endpoint). So `suggestion` always equals the original query under the
// mock, and views/templates/fragments/search-suggestion.ejs (which renders
// `#term-suggested`) never gets included. This test is unconditionally
// @live.
test('suggests the corrected domain for a malformed query @live', async ({ pageSearchPage, page }) => {
    await pageSearchPage.goto('amazoncouk');

    const suggestion = page.locator('#term-suggested');

    // Hard assertion in the legacy suite (plain assertThat, not appendError).
    await expect(suggestion).toContainText('Será que quis dizer: amazon.co.uk');
});
