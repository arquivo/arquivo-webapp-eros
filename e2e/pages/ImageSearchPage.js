/**
 * Image search results page: /image/search.
 * Selectors from views/partials/images-search-results.ejs,
 * views/templates/fragments/image-result.ejs.
 *
 * Same mock-data contract as PageSearchPage but keyed off totalItems/
 * responseItems and a 25-per-page default (image.results.per.page).
 */
class ImageSearchPage {
    constructor(page) {
        this.page = page;
        this.estimatedResults = page.locator('#estimated-results');
        this.results = page.locator('.image-card');
        this.noResults = page.locator('#no-results-were-found');
        this.previousPageButton = page.locator('button.previous-page');
        this.nextPageButton = page.locator('button.next-page');
        this.modal = page.locator('#modal');
    }

    async goto(query, { locale = 'pt', extraParams = {} } = {}) {
        const params = new URLSearchParams({ q: query, l: locale, ...extraParams });
        await this.page.goto(`/image/search?${params.toString()}`);
    }

    result(index) {
        return this.results.nth(index);
    }

    async openResult(index) {
        await this.result(index).locator('a.results-image').click();
    }
}

module.exports = { ImageSearchPage };
