const { test, expect } = require('../../fixtures');
const { searchThenOpenAdvancedSearch } = require('./helpers');

// The collection field becomes a collection: query term, which
// src/apis/page-search-api.js sends to /textsearch as the collection parameter.

test('adds the collections to the query', async ({ searchBar, advancedSearchPage }) => {
    await searchThenOpenAdvancedSearch(searchBar, 'teste');

    await advancedSearchPage.collection.fill('EAWP6, EAWP8,EAWP15');

    await advancedSearchPage.submit();

    await expect(searchBar.input).toHaveValue('teste collection:EAWP6,EAWP8,EAWP15');
});

test('fills the field back in from several collection: query terms', async ({ page, advancedSearchPage }) => {
    await page.goto('/page/advanced/search?l=pt&q=' + encodeURIComponent('teste collection:EAWP6 collection:EAWP8'));

    await expect(advancedSearchPage.withWords).toHaveValue('teste');
    await expect(advancedSearchPage.collection).toHaveValue('EAWP6,EAWP8');
});
