const { test, expect } = require('../../fixtures');

// Ported from docs/webapp/pagesearch/PageSearchTest.md.
//
// The doc's two checks have very different reproducibility under the mock:
// - The estimated-results message ("Cerca de X resultados desde 1991 até
//   <current year>") only depends on the default archive date range
//   (config `search.start.date` = 19910806, and "today" for the upper
//   bound), both of which the mock server echoes back verbatim regardless
//   of query content — so it's fully deterministic and kept as a mocked
//   test.
// - The "at least 80% of results mention fccn" relevance check depends on
//   real search relevance; the mock always returns the same fixed 47-result
//   corpus (its snippets happen to mention the literal query text, which
//   would make this pass vacuously rather than meaningfully) — so per the
//   mock data contract this is tagged @live and written against real
//   content expectations instead.

test('shows a full-archive estimated-results range for a collection-filtered search', async ({ pageSearchPage }) => {
    await pageSearchPage.goto('fccn collection:Roteiro');

    const currentYear = new Date().getFullYear();
    const text = await pageSearchPage.estimatedResults.textContent();

    expect.soft(text).toContain('Cerca de ');
    expect.soft(text).toContain(`resultados desde 1991 até ${currentYear}`);
});

test('shows relevant results for a collection-filtered fccn search @live', async ({ pageSearchPage }) => {
    await pageSearchPage.goto('fccn collection:Roteiro');

    const currentYear = new Date().getFullYear();
    const text = await pageSearchPage.estimatedResults.textContent();
    expect.soft(text).toContain('Cerca de ');
    expect.soft(text).toContain(`resultados desde 1991 até ${currentYear}`);

    const totalResults = await pageSearchPage.results.count();
    const relevantResults = await pageSearchPage.results.filter({ hasText: /fccn/i }).count();

    // Hard assertion in the legacy suite (plain assertTrue, not appendError):
    // at least 80% of results should mention the search term.
    expect(10 * relevantResults).toBeGreaterThanOrEqual(8 * totalResults);
});
