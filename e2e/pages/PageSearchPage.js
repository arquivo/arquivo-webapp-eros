/**
 * Page (full-text) search results page: /page/search.
 * Selectors from views/templates/body/body-pages-search-results.ejs,
 * views/partials/pages-search-results.ejs, views/templates/fragments/page-result.ejs,
 * views/templates/fragments/navigation-tools.ejs.
 *
 * Under mock mode (e2e/mock-server): any non-empty, non garbage query
 * returns a fixed 47-result corpus (10/page); the sentinel garbage query
 * (NO_RESULTS_QUERY, see e2e/mock-server/fixtures.js) always returns 0 results.
 */
class PageSearchPage {
    constructor(page) {
        this.page = page;
        this.estimatedResults = page.locator('#estimated-results');
        this.results = page.locator('.page-search-result');
        this.noResults = page.locator('#no-results-were-found');
        this.previousPageButton = page.locator('button.previous-page');
        this.nextPageButton = page.locator('button.next-page');
    }

    async goto(query, { locale = 'pt', extraParams = {} } = {}) {
        const params = new URLSearchParams({ q: query, l: locale, ...extraParams });
        await this.page.goto(`/page/search?${params.toString()}`);
    }

    result(index) {
        return this.results.nth(index);
    }
}

module.exports = { PageSearchPage };
