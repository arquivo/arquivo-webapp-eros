const { test, expect } = require('../../fixtures');

// Ported from docs/webapp/narrative/NarrativeButtonTest.md.
//
// The confirm/cancel modal (#confirm-narrative-modal,
// views/templates/fragments/search-tools-buttons.ejs) and its "OK" form
// (#search-form-narrative) are unchanged from the legacy doc's selectors.
//
// Deviation from the legacy doc: the doc additionally expects `last_years=10`
// in the destination URL. The current narrative form only carries `lang` and
// `query` as hidden inputs (`narrativeRequestData` in
// search-tools-buttons.ejs sets only those two) - there is no `last_years`
// param anywhere in this codebase (grepped views/ and public/js/), so that
// param appears to have been dropped/simplified since the legacy suite was
// written. This spec only asserts what the app actually sends today.
//
// Confirming genuinely navigates off-app to contamehistorias.pt
// (config.get('contame.historias.search.url'), config/default.properties -
// not overridden by the mocked-mode webServer env in playwright.config.js).
// To keep this spec deterministic/network-independent under the default
// mocked run, the navigation request is intercepted via page.route() and
// fulfilled locally rather than tagged @live - we only care that the
// browser *would* navigate to the right URL, not about the real site's
// response.
test('cancelling and confirming the Narrative search-tools modal', async ({ page, searchBar }) => {
    await page.route('https://contamehistorias.pt/**', (route) => route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html><body>Mocked ContaMeHistorias.pt</body></html>',
    }));

    await searchBar.goto('pt');
    await searchBar.input.fill('fccn');

    const modal = page.locator('#confirm-narrative-modal');

    // Open, verify warning text, cancel.
    await searchBar.narrativeButton.click();
    await expect(modal).toBeVisible();
    await expect.soft(modal.locator('ul > li').first().locator('p'))
        .toHaveText('Vai sair do Arquivo.pt para o ContaMeHistorias.pt');

    await modal.locator('a[rel="modal:close"] button.cancel').click();
    await expect.soft(modal).toBeHidden({ timeout: 20000 });

    // Re-open and confirm: navigates to ContaMeHistorias.pt with the query.
    await searchBar.narrativeButton.click();
    await expect(modal).toBeVisible();
    await page.locator('#search-form-narrative button[type="submit"]').click();

    await expect.poll(() => page.url(), { timeout: 20000 }).toContain('https://contamehistorias.pt/arquivopt/search');
    expect.soft(page.url()).toContain('query=fccn');
    expect.soft(page.url()).toContain('lang=pt');
});
