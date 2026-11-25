'use strict';

const { test, expect } = require('../../../fixtures');

// The "Search on site" entry of the replay options menu opens #search-on-site
// (views/templates/header/header-replay.ejs), a GET form that public/js/search-on-site.js
// completes with "site:<host> <terms>". The host is read from #menuUrl when the modal
// opens; replay.js updates #menuUrl on each navigation inside the replay, which the
// tests below do directly.
const WAYBACK_EXAMPLE = '/wayback/19961013145650/http://www.fccn.pt/';

const searchParams = (page) => new URL(page.url()).searchParams;

const LOCALES = [
    { i18nCookie: 'pt_PT', l: 'pt', entry: 'Pesquisar no site', subdomains: 'Incluir subdomínios', pages: 'Páginas', images: 'Imagens' },
    { i18nCookie: 'en_GB', l: 'en', entry: 'Search on site', subdomains: 'Include subdomains', pages: 'Pages', images: 'Images' },
];

for (const { i18nCookie, l, entry, subdomains, pages, images } of LOCALES) {
    test(`search on site in ${l}: the entry, the modal and a page search`, async ({ page, replayOptionsMenu, baseURL }) => {
        await page.context().addCookies([{ name: 'i18n', value: i18nCookie, url: baseURL }]);
        await page.goto(WAYBACK_EXAMPLE);
        await replayOptionsMenu.open();

        // Right after "List versions".
        await expect(replayOptionsMenu.nav.locator('li', { has: replayOptionsMenu.listVersionsLink })
            .locator('+ li')).toContainText(entry);

        await replayOptionsMenu.searchOnSiteLink.click();
        await expect(replayOptionsMenu.searchOnSiteModal).toBeVisible();
        await expect(page.getByRole('dialog', { name: `${entry} fccn.pt` })).toBeVisible();
        await expect(replayOptionsMenu.searchOnSiteHost).toHaveText('fccn.pt');
        await expect(replayOptionsMenu.searchOnSiteTerms).toBeFocused();
        await expect(replayOptionsMenu.searchOnSiteModal.locator('label[for="search-on-site-terms"]')).toBeVisible();
        await expect(replayOptionsMenu.searchOnSiteModal.getByText(subdomains, { exact: true })).toBeVisible();
        await expect(page.getByLabel(subdomains)).not.toBeChecked();
        await expect(page.getByRole('button', { name: pages, exact: true })).toBeDisabled();
        await expect(page.getByRole('button', { name: images, exact: true })).toBeDisabled();

        // Enter runs the Pages search, with the terms unchanged.
        const terms = 'ronaldo "a&b" #x ação';
        await replayOptionsMenu.searchOnSiteTerms.fill(terms);
        await expect(replayOptionsMenu.searchOnSitePagesButton).toBeEnabled();
        await replayOptionsMenu.searchOnSiteTerms.press('Enter');

        await expect(page).toHaveURL(/\/page\/search\?/);
        expect(searchParams(page).get('q')).toBe(`site:fccn.pt ${terms}`);
        expect(searchParams(page).get('l')).toBe(l);
    });
}

test('search on site: images of the site and its subdomains, with the keyboard', async ({ page, replayOptionsMenu }) => {
    await page.goto(WAYBACK_EXAMPLE);
    await replayOptionsMenu.open();
    await replayOptionsMenu.searchOnSiteLink.click();

    await replayOptionsMenu.searchOnSiteTerms.fill('eleições');
    await page.keyboard.press('Tab');
    await expect(replayOptionsMenu.searchOnSiteSubdomains).toBeFocused();
    await page.keyboard.press('Space');
    await expect(replayOptionsMenu.searchOnSiteSubdomains).toBeChecked();
    await replayOptionsMenu.searchOnSiteImagesButton.click();

    await expect(page).toHaveURL(/\/image\/search\?/);
    expect(searchParams(page).get('q')).toBe('site:*.fccn.pt eleições');
});

test('search on site: Escape and Cancel close the modal and focus the menu entry', async ({ page, replayOptionsMenu }) => {
    await page.goto(WAYBACK_EXAMPLE);
    await replayOptionsMenu.open();

    await replayOptionsMenu.searchOnSiteLink.click();
    await expect(replayOptionsMenu.searchOnSiteTerms).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(replayOptionsMenu.searchOnSiteModal).toBeHidden();
    await expect(replayOptionsMenu.searchOnSiteLink).toBeFocused();

    await replayOptionsMenu.searchOnSiteLink.click();
    await expect(replayOptionsMenu.searchOnSiteModal).toBeVisible();
    await replayOptionsMenu.searchOnSiteCancelButton.click();
    await expect(replayOptionsMenu.searchOnSiteModal).toBeHidden();
    await expect(replayOptionsMenu.searchOnSiteLink).toBeFocused();
});

test('search on site: follows the page shown in the replay', async ({ page, replayOptionsMenu }) => {
    await page.goto(WAYBACK_EXAMPLE);
    await replayOptionsMenu.open();
    // What replay.js does when the replay moves to another host.
    await page.locator('#menuUrl').evaluate((el) => { el.textContent = 'https://desporto.publico.pt/benfica'; });

    await replayOptionsMenu.searchOnSiteLink.click();
    await expect(replayOptionsMenu.searchOnSiteHost).toHaveText('desporto.publico.pt');
    await replayOptionsMenu.searchOnSiteTerms.fill('benfica');
    await replayOptionsMenu.searchOnSiteSubdomains.check();
    await replayOptionsMenu.searchOnSitePagesButton.click();

    await expect(page).toHaveURL(/\/page\/search\?/);
    expect(searchParams(page).get('q')).toBe('site:*.desporto.publico.pt benfica');
});
