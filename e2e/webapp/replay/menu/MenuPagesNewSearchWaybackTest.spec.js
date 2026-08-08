const { test, expect } = require('../../../fixtures');

// Ported from docs/webapp/replay/menu/MenuPagesNewSearchWaybackTest.md.
// Selectors use the current left-nav menu template
// (views/templates/menu/left_nav_menu.ejs, shared between the homepage and
// replay pages) rather than the stale `#menuButton`/`#pagesMenu` ones in
// the legacy doc.
const WAYBACK_EXAMPLE = '/wayback/19961013145650/http://www.fccn.pt/';

test('navigates to the page search page from a wayback page via the menu', async ({ page, menuPage }) => {
    await page.goto(WAYBACK_EXAMPLE);

    await menuPage.open();
    await page.locator('#menu-pages > a').click();
    await page.locator('#menu-pages-new-search a').click();

    // Soft/appendError-style in the original doc.
    await expect.soft(page).toHaveURL(/\/page\/search\?/, { timeout: 20000 });
});
