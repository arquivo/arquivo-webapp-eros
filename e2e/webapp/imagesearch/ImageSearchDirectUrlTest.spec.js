const { test, expect } = require('../../fixtures');

/**
 * Ported from docs/webapp/imagesearch/ImageSearchDirectUrlTest.md.
 *
 * The original Java doc deep-links to /image/search with a plain word query
 * (`query=fccn`) plus a fixed 2007 date range, and asserts on real crawl
 * content (result count text, domain, localized button labels) — none of
 * which is reproducible against the mock corpus (e2e/mock-server/fixtures.js
 * always returns the same 47-item corpus regardless of query/date range).
 *
 * Per the porting brief, src/router.js's `/image/search` handler has a more
 * interesting, deterministic-and-mockable behavior worth covering directly:
 * a URL-shaped query (e.g. "fccn.pt") gets rewritten to `site:fccn.pt`
 * in-place (no redirect — same route re-renders with the rewritten query).
 * That mechanic, plus the PT/EN localized labels, are covered here without
 * `@live`. The original doc's literal historical-content scenario (fixed
 * fccn.pt 2007 captures, localized result-count text) is preserved as
 * `@live` specs below.
 */

test('converts a URL-shaped direct-URL query into a site: search', async ({ page, searchBar, imageSearchPage }) => {
    await imageSearchPage.goto('fccn.pt', { locale: 'pt' });

    await expect(imageSearchPage.results.first()).toBeVisible();
    await expect.soft(searchBar.input).toHaveValue('site:fccn.pt');
});

for (const { locale, label } of [
    { locale: 'pt', label: 'Imagens' },
    { locale: 'en', label: 'Images' },
]) {
    test(`localizes the images-tab label for a direct URL-shaped search (${locale})`, async ({ searchBar, imageSearchPage }) => {
        await imageSearchPage.goto('fccn.pt', { locale });

        await expect(imageSearchPage.results.first()).toBeVisible();
        await expect.soft(searchBar.imagesTab).toHaveText(label);
    });
}

test('shows real fccn.pt results for a historical direct URL search with no language param @live', async ({ page }) => {
    await page.goto(
        '/image/search?' +
            new URLSearchParams({
                size: 'all',
                type: '',
                safeSearch: 'on',
                q: 'fccn',
                dateStart: '26/06/2007',
                dateEnd: '27/06/2007',
            }).toString()
    );

    const firstResult = page.locator('#image-card-1');
    await expect(firstResult).toBeVisible();
    await expect.soft(firstResult.locator('.results-url')).toContainText('fccn.pt');
});

for (const { locale, imagesLabel, estimateText } of [
    { locale: 'pt', imagesLabel: 'Imagens', estimateText: 'resultados desde 2007 até 2007' },
    { locale: 'en', imagesLabel: 'Images', estimateText: 'results from 2007 to 2007' },
]) {
    test(`shows localized real fccn.pt results for a historical direct URL search (${locale}) @live`, async ({ page, searchBar, imageSearchPage }) => {
        await page.goto(
            '/image/search?' +
                new URLSearchParams({
                    size: 'all',
                    type: '',
                    safeSearch: 'on',
                    q: 'fccn',
                    dateStart: '26/06/2007',
                    dateEnd: '27/06/2007',
                    l: locale,
                }).toString()
        );

        const firstResult = page.locator('#image-card-1');
        await expect(firstResult).toBeVisible();
        await expect.soft(imageSearchPage.estimatedResults).toContainText(estimateText);
        await expect.soft(firstResult.locator('.results-url')).toContainText('fccn.pt');
        await expect.soft(searchBar.imagesTab).toHaveText(imagesLabel);
    });
}
