const { test, expect } = require('../../../fixtures');

// Ported from docs/webapp/replay/menu/MenuAboutWaybackTest.md.
// Selectors below use the current templates (e2e/pages/MenuPage.js +
// views/templates/menu/left_nav_menu.ejs, which is shared between the
// homepage and replay pages) rather than the stale ones in the legacy doc
// (`#menuButton`, `div.swiper-slide...`), which no longer exist.
//
// Verified quirk (as of this writing): app.js's i18n middleware deliberately
// ignores the `?l=` query param on any `/wayback/*` URL — it overwrites
// `req.query.l` with the locale derived from the `i18n` cookie (defaulting
// to `pt_PT`) before running i18n resolution, then restores the original
// query param afterwards (only `/switchlang`, per src/router.js, actually
// persists a locale choice into that cookie; see its "Add language
// parameter to URL (except for wayback routes)" comment). So, unlike the
// homepage, a wayback page's rendered locale can't be chosen via `?l=`
// alone — the `i18n` cookie has to already reflect the desired locale, as
// it would after a real prior visit to /switchlang. This test sets that
// cookie directly to mirror that.
//
// Tagged @live (like menu/MenuAboutHomepageTest.spec.js): the About link
// navigates off-domain to the real sobre.arquivo.pt microsite, which the
// mock server does not (and cannot) stub — this depends on genuine external
// network access/content regardless of E2E_MODE.
const WAYBACK_EXAMPLE = '/wayback/19961013145650/http://www.fccn.pt/';

const LOCALES = [
    { locale: 'pt', i18nCookie: 'pt_PT', expectedUrl: 'https://sobre.arquivo.pt/pt/' },
    { locale: 'en', i18nCookie: 'en_GB', expectedUrl: 'https://sobre.arquivo.pt/en/' },
];

for (const { locale, i18nCookie, expectedUrl } of LOCALES) {
    test(`opens the ${locale} locale about page from a wayback page via the menu @live`, async ({ page, menuPage, baseURL }) => {
        await page.context().addCookies([{ name: 'i18n', value: i18nCookie, url: baseURL }]);
        await page.goto(WAYBACK_EXAMPLE);

        await menuPage.open();
        await page.locator('#menu-about a').click();

        // Soft/appendError-style in the original doc.
        await expect.soft(page).toHaveURL(expectedUrl, { timeout: 20000 });
    });
}
