const { test, expect } = require('../../../fixtures');

// Ported from docs/webapp/replay/menu/MenuSavePageNowTest.md.
// Selectors use the current left-nav menu template
// (views/templates/menu/left_nav_menu.ejs, shared between the homepage and
// replay pages) rather than the stale `#menuButton`/`#swiperWrapper` ones in
// the legacy doc.
//
// The "SavePageNow" naming from the legacy doc has been fully retired in
// current translations (translations/page-search.yml only references
// "ArchivePageNow"); the left-nav item is `#menu-archivepagenow`, linking to
// /services/archivepagenow. A legacy /services/savepagenow route still
// exists in src/router.js but only as a redirect to /services/archivepagenow,
// so we only assert on the current, final URL.
const WAYBACK_EXAMPLE = '/wayback/19961013145650/http://www.fccn.pt/';

test('navigates to the archive-page-now service from a wayback page via the menu', async ({ page, menuPage }) => {
    await page.goto(WAYBACK_EXAMPLE);

    await menuPage.open();
    await page.locator('#menu-archivepagenow a').click();

    // Soft/appendError-style in the original doc.
    await expect.soft(page).toHaveURL(/\/services\/archivepagenow\?/, { timeout: 20000 });
});
