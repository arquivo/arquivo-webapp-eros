const { test, expect } = require('../../fixtures');
const { MOCK_TIMELINE_LAST_YEAR, NO_RESULTS_QUERY } = require('../../mock-server/fixtures');

// Impact timeline bars drawn above the date slider on page search results
// (public/js/search-impact-graph.js), fed by the text search API's
// `timeline` reply. Under the mock, that's MOCK_TIMELINE
// (e2e/mock-server/fixtures.js): 4 years with impact, 2015 with none.

const QUERY = 'lisboa';

test('draws one bar per year with impact, none for years without it', async ({ pageSearchPage }) => {
    await pageSearchPage.goto(QUERY);

    await expect(pageSearchPage.impactBars).toHaveCount(4);
    for (const year of [1996, 2005, 2010, MOCK_TIMELINE_LAST_YEAR]) {
        await expect.soft(pageSearchPage.impactBar(year)).toHaveCount(1);
    }
    await expect.soft(pageSearchPage.impactBar(2015)).toHaveCount(0);
});

test('scales the year with the most impact to the full graph height', async ({ pageSearchPage }) => {
    await pageSearchPage.goto(QUERY);

    await expect(pageSearchPage.impactBars).toHaveCount(4);
    // 2010 holds 40% of the impact, 2005 holds 10%: a quarter of the height
    await expect.soft(pageSearchPage.impactBar(2010)).toHaveAttribute('style', /height: 100%/);
    const tallest = await pageSearchPage.impactBar(2010).boundingBox();
    const smaller = await pageSearchPage.impactBar(2005).boundingBox();
    expect.soft(smaller.height / tallest.height).toBeCloseTo(1 / 4, 1);
});

test('shows the year and its impact percentage on hover', async ({ pageSearchPage }) => {
    await pageSearchPage.goto(QUERY);

    await expect(pageSearchPage.impactTooltip).toBeHidden();
    await pageSearchPage.hoverImpactBar(2010);

    await expect(pageSearchPage.impactTooltip).toBeVisible();
    await expect.soft(pageSearchPage.impactTooltip).toHaveText('2010: 40.00%');
});

test('hides the tooltip once the pointer leaves the bar', async ({ page, pageSearchPage }) => {
    await pageSearchPage.goto(QUERY);

    await pageSearchPage.hoverImpactBar(2010);
    await expect(pageSearchPage.impactTooltip).toBeVisible();

    await page.mouse.move(0, 0);
    await expect(pageSearchPage.impactTooltip).toBeHidden();
});

// Regression: the tooltip used to live inside #slider-range-container, whose
// `z-index: 0` trapped it under the slider handle, date boxes and buttons.
test('draws the tooltip on top of everything else on the page', async ({ pageSearchPage }) => {
    await pageSearchPage.goto(QUERY);

    await expect(pageSearchPage.impactBars).toHaveCount(4);
    for (const year of [1996, 2005, 2010, MOCK_TIMELINE_LAST_YEAR]) {
        await pageSearchPage.hoverImpactBar(year);
        await expect(pageSearchPage.impactTooltip).toBeVisible();

        const coveredBy = await pageSearchPage.impactTooltip.evaluate((tooltip) => {
            // pointer-events: none would make elementFromPoint look straight through it
            tooltip.style.pointerEvents = 'auto';
            const box = tooltip.getBoundingClientRect();
            const points = [
                [box.left + 2, box.top + 2],
                [box.right - 2, box.top + 2],
                [box.left + 2, box.bottom - 2],
                [box.right - 2, box.bottom - 2],
                [box.left + box.width / 2, box.top + box.height / 2],
            ];
            const covering = points
                .map(([x, y]) => document.elementFromPoint(x, y))
                .filter((element) => element && !tooltip.contains(element))
                .map((element) => element.tagName + '#' + element.id + '.' + element.className);
            tooltip.style.pointerEvents = '';
            return covering;
        });
        expect.soft(coveredBy, `tooltip of ${year} is covered`).toEqual([]);
    }
});

test('keeps the tooltip of the first and last bars inside the viewport', async ({ page, pageSearchPage }) => {
    await pageSearchPage.goto(QUERY);

    await expect(pageSearchPage.impactBars).toHaveCount(4);
    const viewportWidth = page.viewportSize().width;
    for (const year of [1996, MOCK_TIMELINE_LAST_YEAR]) {
        await pageSearchPage.hoverImpactBar(year);
        await expect(pageSearchPage.impactTooltip).toBeVisible();

        const box = await pageSearchPage.impactTooltip.boundingBox();
        expect.soft(box.x, `tooltip of ${year} left edge`).toBeGreaterThanOrEqual(0);
        expect.soft(box.x + box.width, `tooltip of ${year} right edge`).toBeLessThanOrEqual(viewportWidth);
    }
});

test('draws no bars when the search has no results', async ({ pageSearchPage }) => {
    await pageSearchPage.goto(NO_RESULTS_QUERY);

    await expect(pageSearchPage.noResults).toBeVisible();
    await expect(pageSearchPage.impactBars).toHaveCount(0);
});

test('has no impact graph on image search', async ({ page, imageSearchPage }) => {
    await imageSearchPage.goto(QUERY);

    await expect(imageSearchPage.results.first()).toBeVisible();
    await expect(page.locator('#search-impact-graph')).toHaveCount(0);
});
