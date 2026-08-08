const { test, expect } = require('../../../fixtures');

// Ported from docs/webapp/replay/menu/MenuPagesNewAvancedSearchWaybackTest.md
// (typo "Avanced" kept in the doc's source class/method name; fixed here in
// the file name only insofar as we keep the same spelling for traceability).
// Selectors use the current left-nav menu template
// (views/templates/menu/left_nav_menu.ejs, shared between the homepage and
// replay pages) rather than the stale `#menuButton`/`#pagesMenu`/`#pageOptions`
// ones in the legacy doc.
const WAYBACK_EXAMPLE = '/wayback/19961013145650/http://www.fccn.pt/';

test('navigates to the page advanced search page from a wayback page via the menu', async ({ page, menuPage }) => {
    await page.goto(WAYBACK_EXAMPLE);

    await menuPage.open();
    await page.locator('#menu-pages > a').click();
    await page.locator('#menu-pages-advanced-search a').click();

    // Soft/appendError-style in the original doc.
    await expect.soft(page).toHaveURL(/\/page\/advanced\/search\?/, { timeout: 20000 });
});
