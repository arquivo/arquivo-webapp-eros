const { test, expect } = require('../../fixtures');

// The number of results field is sent to /imagesearch as maxItems.

test('defaults to the configured number of results', async ({ advancedSearchPage }) => {
    await advancedSearchPage.gotoImages('pt');

    await expect(advancedSearchPage.maxItems).toHaveValue('25');
});

test('searches with the chosen number of results', async ({ page, advancedSearchPage }) => {
    await advancedSearchPage.gotoImages('pt');

    await advancedSearchPage.withWords.fill('teste');
    await advancedSearchPage.maxItems.selectOption('100');

    await advancedSearchPage.submit();

    await expect(page).toHaveURL(/\/image\/search\?.*maxItems=100/);
});

test('fills the field back in from the maxItems parameter', async ({ advancedSearchPage, page }) => {
    await page.goto('/image/advanced/search?l=pt&q=teste&maxItems=200');

    await expect(advancedSearchPage.maxItems).toHaveValue('200');
});
