const { test, expect } = require('../../fixtures');

// Ported from docs/webapp/pagesearch/PageSearchNotSpamTest.md.
//
// This is a pure real-content relevance/spam-filtering check ("no result
// for 'lisboa' mentions 'olx'") with no form/URL mechanics to fall back on.
// The mock's fixed corpus never contains "olx" in any circumstance, so the
// assertion would pass vacuously (regardless of any real spam filtering)
// rather than meaningfully — per the mock data contract this is tagged
// @live rather than kept as a mocked test.
test('shows no olx-related spam results for lisboa @live', async ({ pageSearchPage }) => {
    await pageSearchPage.goto('lisboa');
    await expect(pageSearchPage.results.first()).toBeVisible();

    const spamCount = await pageSearchPage.results.filter({ hasText: /olx/i }).count();

    // Hard assertion in the legacy suite (plain assertTrue, not appendError).
    expect(spamCount).toBe(0);
});
