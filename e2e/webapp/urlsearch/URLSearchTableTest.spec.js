const { test, expect } = require('../../fixtures');

// Ported from docs/webapp/urlsearch/URLSearchTableTest.md.
//
// The doc's real scenario depends on fccn.pt's earliest live capture being
// 19961013145650 (13 October 1996). Under the mock server, any url instead
// returns a fixed set of 5 captures at pre-2020 timestamps, one per year
// 2015-2019 (see e2e/mock-server/fixtures.js CDX_SNAPSHOT_TIMESTAMPS) — so
// the mocked test below checks the table cell for one of those fixed
// captures (2016-08-20, chosen because its month abbreviation differs
// between locales: "Aug" vs "Ago" — translations/common.yml shortMonths),
// while a `@live` test ports the doc's literal fccn.pt/1996 assertions.
//
// Note (also called out in the doc): the `tableText` ("Tabela"/"Table")
// param from the original Java test is dead — the toggle button's label is
// never actually asserted, only the first-result cell's text — so this port
// doesn't check the button label either.

const CELL_ID = 'table-cell-20160820130000';

test('shows the mock captures earliest-first per year in the table view (PT)', async ({ page, urlSearchPage }) => {
    await urlSearchPage.goto('fccn.pt', { viewMode: 'table', locale: 'pt' });
    await expect(urlSearchPage.tableContainer).toBeVisible();

    await expect(urlSearchPage.tableCells).toHaveCount(5);
    const cell = page.locator(`#${CELL_ID}`);
    await expect(cell).toHaveText('20 Ago');
    // Doc repeats the same check as a soft assertion ("Verify specific timetamp" [sic]).
    await expect.soft(cell).toHaveText('20 Ago');
});

test('shows the mock captures earliest-first per year in the table view (EN)', async ({ page, urlSearchPage }) => {
    await urlSearchPage.goto('fccn.pt', { viewMode: 'table', locale: 'en' });
    await expect(urlSearchPage.tableContainer).toBeVisible();

    await expect(urlSearchPage.tableCells).toHaveCount(5);
    const cell = page.locator(`#${CELL_ID}`);
    await expect(cell).toHaveText('20 Aug');
    await expect.soft(cell).toHaveText('20 Aug');
});

test('shows the real fccn.pt earliest 1996 capture in the table view (PT) @live', async ({ page, urlSearchPage }) => {
    await urlSearchPage.goto('fccn.pt', { viewMode: 'table', locale: 'pt' });
    await expect(urlSearchPage.tableContainer).toBeVisible();

    const cell = page.locator('#table-cell-19961013145650');
    await expect(cell).toHaveText('13 Out');
    await expect.soft(cell).toHaveText('13 Out');
});

test('shows the real fccn.pt earliest 1996 capture in the table view (EN) @live', async ({ page, urlSearchPage }) => {
    await urlSearchPage.goto('fccn.pt', { viewMode: 'table', locale: 'en' });
    await expect(urlSearchPage.tableContainer).toBeVisible();

    const cell = page.locator('#table-cell-19961013145650');
    await expect(cell).toHaveText('13 Oct');
    await expect.soft(cell).toHaveText('13 Oct');
});
