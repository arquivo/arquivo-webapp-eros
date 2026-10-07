/**
 * Page (full-text) search results page: /page/search.
 * Selectors from views/templates/body/body-pages-search-results.ejs,
 * views/partials/pages-search-results.ejs, views/templates/fragments/page-result.ejs,
 * views/templates/fragments/navigation-tools.ejs.
 *
 * Under mock mode (e2e/mock-server): any non-empty, non garbage query
 * returns a fixed 47-result corpus (10/page); the sentinel garbage query
 * (NO_RESULTS_QUERY, see e2e/mock-server/fixtures.js) always returns 0 results.
 * The impact bars above the date slider come from MOCK_TIMELINE (same file).
 */
class PageSearchPage {
    constructor(page) {
        this.page = page;
        this.estimatedResults = page.locator('#estimated-results');
        this.results = page.locator('.page-search-result');
        this.noResults = page.locator('#no-results-were-found');
        this.previousPageButton = page.locator('button.previous-page');
        this.nextPageButton = page.locator('button.next-page');
        this.impactGraph = page.locator('#search-impact-graph');
        this.impactBars = this.impactGraph.locator('.impact-bar');
        this.impactTooltip = page.locator('.impact-bar-tooltip');
    }

    async goto(query, { locale = 'pt', extraParams = {} } = {}) {
        const params = new URLSearchParams({ q: query, l: locale, ...extraParams });
        await this.page.goto(`/page/search?${params.toString()}`);
    }

    result(index) {
        return this.results.nth(index);
    }

    // Bars carry no year attribute of their own, but their aria-label starts with it
    impactBar(year) {
        return this.impactGraph.locator(`.impact-bar[aria-label^="${year},"]`);
    }

    // Hover near the top of the bar: on narrow screens the slider handles
    // cover the bottom of the outermost bars, same as for a real user
    async hoverImpactBar(year) {
        const bar = this.impactBar(year);
        const box = await bar.boundingBox();
        await bar.hover({ position: { x: box.width / 2, y: 1 } });
    }
}

module.exports = { PageSearchPage };
