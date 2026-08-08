const { test, expect } = require('../../fixtures');

// Ported from docs/webapp/citationsaver/CitationSaverTest.md.
//
// Template: views/templates/body/body-services-citation-saver.ejs. All ids
// in the legacy doc are still current: #logo-citation-saver,
// #citation-saver-slogan, #citation-saver-main (with the instructional text
// as its 3rd <p>), `form label[for="input-url-url"]`,
// `label[for="input-file-upload"]` (the "Ficheiros"/"File" tab) and
// `form label[for="input-file-file"]`. All expected strings match
// translations/services-citation-saver.yml (pt) verbatim.
//
// The legacy doc special-cases iOS (JS-click instead of native click,
// "IOS driver is dumb..."); not needed here since Playwright's click works
// uniformly across engines/projects.
test('shows the CitationSaver slogan, instructions and file-upload tab label', async ({ page }) => {
    await page.goto('/services/citationsaver?l=pt');

    await expect(page.locator('#logo-citation-saver')).toBeVisible();

    await expect.soft(page.locator('#citation-saver-slogan'))
        .toHaveText('Preserva citações a conteúdos online');
    await expect.soft(page.locator('#citation-saver-main > p').nth(2))
        .toHaveText('Submeta um documento e o CitationSaver preservará as ligações nele citadas:');
    await expect.soft(page.locator('form label[for="input-url-url"]'))
        .toHaveText('Insira o URL do documento:');

    await page.locator('label[for="input-file-upload"]').click();

    await expect.soft(page.locator('form label[for="input-file-file"]'))
        .toHaveText('Carregue um documento a partir do seu computador:');
});
