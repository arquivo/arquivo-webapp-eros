const { test, expect } = require('../../fixtures');

/**
 * Ported from docs/webapp/menu/MenuPagesNewSearchHomepageTest.md.
 *
 * See MenuImagesAdvancedSearchHomepageTest.spec.js for notes on the
 * accordion toggle needing to be opened before its nested links
 * (views/templates/menu/left_nav_menu.ejs) become clickable.
 */
test('opens the page search page from the homepage menu', async ({ page, searchBar, menuPage }) => {
    await searchBar.goto('pt');
    await menuPage.open();

    // "Open pages sub menu"
    await page.locator('#menu-pages a.accordion-left-menu').click();

    // "Click new search button"
    await page.locator('#menu-pages-new-search a').click();

    // "Check if current url is the page search"
    await expect.soft(page).toHaveURL(/\/page\/search\?/, { timeout: 20000 });
});
