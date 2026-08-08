const { test, expect } = require('../../fixtures');

/**
 * Ported from docs/webapp/menu/MenuPagesNewAvancedSearchHomepageTest.md
 * (class name typo "Avanced" preserved from the original Java source/doc
 * filename; not used in identifiers here).
 *
 * See MenuImagesAdvancedSearchHomepageTest.spec.js for notes on the
 * accordion toggle needing to be opened before its nested links
 * (views/templates/menu/left_nav_menu.ejs) become clickable.
 */
test('opens the pages advanced search page from the homepage menu', async ({ page, searchBar, menuPage }) => {
    await searchBar.goto('pt');
    await menuPage.open();

    // "Open pages sub menu"
    await page.locator('#menu-pages a.accordion-left-menu').click();

    // "Click new advanced search button"
    await page.locator('#menu-pages-advanced-search a').click();

    // "Check if current url is the advanced search"
    await expect.soft(page).toHaveURL(/\/page\/advanced\/search\?/, { timeout: 20000 });
});
