const { test, expect } = require('../../fixtures');

// The collection field becomes a collection: query term, also sent to
// /imagesearch as the collection parameter.

test('adds the collections to the query', async ({ page, searchBar, advancedSearchPage }) => {
    await advancedSearchPage.gotoImages('pt');

    await advancedSearchPage.withWords.fill('teste');
    await advancedSearchPage.collection.fill('EAWP6,EAWP8');

    await advancedSearchPage.submit();

    await expect(page).toHaveURL(/\/image\/search/);
    await expect(searchBar.input).toHaveValue('teste collection:EAWP6,EAWP8');
});

test('fills the field back in from several collection: query terms', async ({ page, advancedSearchPage }) => {
    await page.goto('/image/advanced/search?l=pt&q=' + encodeURIComponent('teste collection:EAWP6 collection:EAWP8'));

    await expect(advancedSearchPage.withWords).toHaveValue('teste');
    await expect(advancedSearchPage.collection).toHaveValue('EAWP6,EAWP8');
});
