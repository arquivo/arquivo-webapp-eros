const { test, expect } = require('../../fixtures');

/**
 * Ported from docs/webapp/menu/MenuImagesNewSearchHomepageTest.md.
 *
 * See MenuImagesAdvancedSearchHomepageTest.spec.js for notes on the
 * #menu-images accordion toggle needing to be opened before its nested
 * links (views/templates/menu/left_nav_menu.ejs) become clickable.
 */
test('opens the image search page from the homepage menu', async ({ page, searchBar, menuPage }) => {
    await searchBar.goto('pt');
    await menuPage.open();

    // "Open images sub menu"
    await page.locator('#menu-images a.accordion-left-menu').click();

    // "Click new search button"
    await page.locator('#menu-images-new-search a').click();

    // "Check if current url is the image search"
    await expect.soft(page).toHaveURL(/\/image\/search\?/, { timeout: 20000 });
});
