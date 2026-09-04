const { test, expect } = require('../../fixtures');

/**
 * Ported from docs/webapp/menu/MenuChangeLanguageTest.md.
 *
 * Labels confirmed against the current translation files:
 * - translations/home.yml: home.search-tools.{pages,images,advanced-search}
 *   -> Páginas/Pages, Imagens/Images, Pesquisa avançada/Advanced search
 * - translations/menu.yml: menu.switch-language.text
 *   -> pt: 'English', en: 'Português' (shows the *other* language's name)
 *
 * The menu-language link (views/templates/menu/left_nav_menu.ejs) points at
 * `/switchlang?l=<currentLocale>`; src/router.js's `/switchlang` handler
 * toggles to the other configured locale and redirects back with `l=<new>`
 * appended, validating the request's Referer host against an allow-list
 * (localhost is allowed, which is what a real link click sends here).
 */
const LABELS = {
    pt: { pages: 'Páginas', images: 'Imagens', advanced: 'Pesquisa avançada', language: 'English' },
    en: { pages: 'Pages', images: 'Images', advanced: 'Advanced search', language: 'Português' },
};

for (const [locale, other] of [
    ['pt', 'en'],
    ['en', 'pt'],
]) {
    test(`switches the site language from ${locale.toUpperCase()} to ${other.toUpperCase()} via the menu`, async ({ page, searchBar, menuPage }) => {
        await searchBar.goto(locale);

        // "Verify page/image/advanced search label" (pre-toggle)
        await expect(searchBar.pagesTab).toHaveText(LABELS[locale].pages);
        await expect(searchBar.imagesTab).toHaveText(LABELS[locale].images);
        await expect(searchBar.advancedTab).toHaveText(LABELS[locale].advanced);

        await menuPage.open();

        // "Verify language label" (pre-toggle) — shows the *other* language's name
        const languageItem = page.locator('#menu-language a');
        await expect(languageItem).toContainText(LABELS[locale].language);

        // "Change language"
        await languageItem.click();

        // "Wait for page to change"
        await page.waitForURL(new RegExp(`[?&]l=${other}(&|$)`), { timeout: 10000 });

        // "Verify page/image/advanced search label" (post-toggle)
        await expect(searchBar.pagesTab).toHaveText(LABELS[other].pages);
        await expect(searchBar.imagesTab).toHaveText(LABELS[other].images);
        await expect(searchBar.advancedTab).toHaveText(LABELS[other].advanced);

        await menuPage.open();

        // "Verify language label" (post-toggle) — now shows the original locale's name
        await expect(languageItem).toContainText(LABELS[other].language);
    });
}
