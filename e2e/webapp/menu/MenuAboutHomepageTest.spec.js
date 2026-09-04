const { test, expect } = require('../../fixtures');

/**
 * Ported from docs/webapp/menu/MenuAboutHomepageTest.md.
 *
 * Navigates off-domain to the real sobre.arquivo.pt microsite, which the
 * mock server does not (and cannot) stub — this always depends on genuine
 * external network access/content regardless of E2E_MODE, so it's tagged
 * `@live` throughout (translations/menu.yml confirms the expected URLs:
 * menu.about.url.pt = https://sobre.arquivo.pt/pt/, .en = .../en/).
 */
const ABOUT_URLS = {
    pt: 'https://sobre.arquivo.pt/pt/',
    en: 'https://sobre.arquivo.pt/en/',
};

for (const locale of ['pt', 'en']) {
    test(`opens the localized About page from the homepage menu (${locale}) @live`, async ({ page, searchBar, menuPage }) => {
        await searchBar.goto(locale);
        await menuPage.open();

        // "Click about button"
        await page.locator('#menu-about a').click();

        // "Check if Arquivo.pt logo appears"
        await expect.soft(page.locator('.headerLogoAndSearch a img')).toBeVisible({ timeout: 100000 });

        // "Verify sobre.arquivo.pt"
        await expect(page).toHaveURL(ABOUT_URLS[locale]);
    });
}
