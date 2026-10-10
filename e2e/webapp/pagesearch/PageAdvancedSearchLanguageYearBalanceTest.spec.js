const { test, expect } = require('../../fixtures');
const { searchThenOpenAdvancedSearch } = require('./helpers');

// The language, minimum language confidence and year balance fields become
// inline query terms (like collection:), which src/apis/page-search-api.js
// sends to /textsearch as their own parameters.

test('adds language, minimum language confidence and year balance to the query', async ({ searchBar, advancedSearchPage }) => {
    await searchThenOpenAdvancedSearch(searchBar, 'fccn');

    await advancedSearchPage.language.fill('pt');
    await advancedSearchPage.minLanguageConfidence.selectOption('MEDIUM');
    await advancedSearchPage.yearBalance.selectOption('0.25');

    await advancedSearchPage.submit();

    await expect(searchBar.input).toHaveValue('fccn yearBalance:0.25 language:pt minLanguageConfidence:MEDIUM');
});

test('fills the fields back in from the inline query terms', async ({ page, advancedSearchPage }) => {
    await page.goto('/page/advanced/search?l=pt&q=' + encodeURIComponent('fccn language:en minLanguageConfidence:LOW yearBalance:true'));

    await expect(advancedSearchPage.withWords).toHaveValue('fccn');
    await expect(advancedSearchPage.language).toHaveValue('en');
    await expect(advancedSearchPage.minLanguageConfidence).toHaveValue('LOW');
    await expect(advancedSearchPage.yearBalance).toHaveValue('true');
});

test('does not add the terms when the fields are left at their defaults', async ({ searchBar, advancedSearchPage }) => {
    await searchThenOpenAdvancedSearch(searchBar, 'fccn');

    await advancedSearchPage.submit();

    await expect(searchBar.input).toHaveValue('fccn');
});
