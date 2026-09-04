/**
 * URL search results page: /url/search (list and table view modes).
 * Selectors from views/partials/url-list-results.ejs and
 * views/partials/url-table-results.ejs.
 *
 * Under mock mode, any url returns a fixed set of 5 old (pre-2020)
 * snapshots (e2e/mock-server/fixtures.js buildCdxResults).
 */
class UrlSearchPage {
    constructor(page) {
        this.page = page;
        this.estimatedResults = page.locator('#estimated-results');
        this.noResults = page.locator('#no-results-were-found');

        this.listContainer = page.locator('#list-results-container');
        this.tableContainer = page.locator('#table-results-container');
        this.yearAccordions = page.locator('.menu-pages-replay-year');
        this.monthAccordions = page.locator('.menu-pages-replay-month');
        this.dateLinks = page.locator('.menu-pages-replay-date-hour a');

        this.tableCells = page.locator('#replay-menu-table td.year-month-data');
    }

    async goto(query, { viewMode = 'list', locale = 'pt', extraParams = {} } = {}) {
        const params = new URLSearchParams({ q: query, viewMode, l: locale, ...extraParams });
        await this.page.goto(`/url/search?${params.toString()}`);
    }
}

module.exports = { UrlSearchPage };
