/**
 * Shared advanced-search form, used by both /page/advanced/search and
 * /image/advanced/search (views/templates/body/body-pages-advanced-search.ejs
 * and body-images-advanced-search.ejs). Uses name-attribute selectors since
 * only the pages-search form exposes ids (#phrase/#words/#without/#website);
 * the images-search form only has name attributes.
 */
class AdvancedSearchPage {
    constructor(page) {
        this.page = page;
        this.form = page.locator('form.advanced-search-form');
        this.withWords = this.form.locator('[name=adv_and]');
        this.withPhrase = this.form.locator('[name=adv_phr]');
        this.withoutWords = this.form.locator('[name=adv_not]');
        this.siteSearch = this.form.locator('[name=siteSearch]');
        this.submitButton = this.form.locator('button[type=submit], .search-form-advanced-button');
    }

    async gotoPages(locale = 'pt') {
        await this.page.goto(`/page/advanced/search?l=${locale}`);
    }

    async gotoImages(locale = 'pt') {
        await this.page.goto(`/image/advanced/search?l=${locale}`);
    }

    formatCheckbox(format) {
        return this.form.locator(`input[type=checkbox][format=${format}]`);
    }

    async submit() {
        await this.submitButton.click();
    }
}

module.exports = { AdvancedSearchPage };
