const { test, expect } = require('../../fixtures');

// Ported from docs/webapp/pagesearch/PageSearchEmptyTest.md.
//
// Uses the mock server's dedicated no-results sentinel (NO_RESULTS_QUERY,
// e2e/mock-server/fixtures.js) instead of the legacy doc's
// `ddadfcfe.cdsffds` — that query contains a dot, which the app's router
// treats as URL-shaped and redirects /page/search to /url/search before
// ever reaching the "no results" template.
//
// The two locale variants (PT/EN) are parameterized here, mirroring the
// doc's note that both JUnit test methods share one private helper.
const NO_RESULTS_QUERY = 'ddadfcfe qwzxjk nosuchresult';

const LOCALES = [
    { locale: 'pt', message: 'Não foram encontrados resultados para a sua pesquisa:' },
    { locale: 'en', message: 'No results were found for the query:' },
];

for (const { locale, message } of LOCALES) {
    test(`shows a locale-appropriate no-results message for ${locale}`, async ({ pageSearchPage }) => {
        await pageSearchPage.goto(NO_RESULTS_QUERY, { locale });

        // The legacy check here constructed an ExpectedCondition but never
        // actually waited on/asserted it (a latent no-op in the Java suite,
        // per the doc's notes) — implemented as a real visibility check here.
        await expect.soft(pageSearchPage.noResults).toBeVisible();

        const text = (await pageSearchPage.noResults.textContent()).trim();
        expect.soft(text).toContain(message);
        expect.soft(text).toContain(NO_RESULTS_QUERY);
    });
}
