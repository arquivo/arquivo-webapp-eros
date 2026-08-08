/**
 * Homepage / global search bar + search-type switcher.
 * Selectors from views/templates/fragments/search-tools-search-bar.ejs and
 * views/templates/fragments/search-tools-buttons.ejs.
 */
class SearchBar {
    constructor(page) {
        this.page = page;
        this.input = page.locator('#submit-search-input');
        this.submitButton = page.locator('#submit-search');
        this.pagesTab = page.locator('#search-form-pages button[type=submit]');
        this.imagesTab = page.locator('#search-form-images button[type=submit]');
        this.advancedTab = page.locator('#search-form-advanced button[type=submit]');
        this.narrativeButton = page.locator('#search-tools-narrative-button');
    }

    async goto(locale = 'pt') {
        await this.page.goto(`/?l=${locale}`);
    }

    async search(query) {
        await this.input.fill(query);
        await this.submitButton.click();
    }
}

module.exports = { SearchBar };
