const { test, expect } = require('../../fixtures');

/**
 * Ported from docs/webapp/menu/MenuImagesAdvancedSearchHomepageTest.md.
 *
 * views/templates/menu/left_nav_menu.ejs: #menu-images is an accordion
 * toggle (`a.accordion-left-menu`) that expands a `ul.panel` (max-height:0
 * by default, see public/css/styles.css) containing #menu-images-advanced-search,
 * whose href is `/image/advanced/search?l=<lang>` — so the toggle must be
 * clicked first to make the nested link visible/clickable.
 */
test('opens the images advanced search page from the homepage menu', async ({ page, searchBar, menuPage }) => {
    await searchBar.goto('pt');
    await menuPage.open();

    // "Open images sub menu"
    await page.locator('#menu-images a.accordion-left-menu').click();

    // "Click advanced"
    await page.locator('#menu-images-advanced-search a').click();

    // "Check if current url is the advanced image search"
    await expect.soft(page).toHaveURL(/\/image\/advanced\/search\?/, { timeout: 20000 });
});
