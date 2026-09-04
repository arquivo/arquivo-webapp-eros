const { test, expect } = require('../../fixtures');

// Ported from docs/webapp/urlsearch/URLSearchListTest.md.
//
// The doc's real scenario is entirely dependent on live archived data for
// fccn.pt (exactly one capture, in October 1996). Under the mock server
// (e2e/mock-server/fixtures.js), any url instead returns a fixed set of 5
// captures at pre-2020 timestamps, one per year 2015-2019, each in a
// distinct month, all status 200 — see e2e/pages/UrlSearchPage.js.
//
// So this file has two kinds of coverage:
// - A mocked test that adapts the doc's grouping/drill-down assertions to
//   the mock's actual data shape (5 year-groups, one month/capture each).
// - Two `@live` tests (PT/EN) that port the doc's literal fccn.pt/1996
//   assertions, which can't be exercised from this sandbox (no preprod
//   network) but are written to match the current templates
//   (views/partials/url-list-results.ejs) and translations
//   (translations/common.yml, translations/url-search.yml).

const CDX_YEARS = ['2015', '2016', '2017', '2018', '2019'];
// One mock capture per year, each in a distinct month (see buildCdxResults'
// CDX_SNAPSHOT_TIMESTAMPS): 2015-06, 2016-08, 2017-09, 2018-07, 2019-03.
const FIRST_YEAR_MONTH = '2015-06';
const FIRST_TIMESTAMP = '20150615120000';

test('groups the mock url-search corpus by year and month (list view)', async ({ page, urlSearchPage }) => {
    await urlSearchPage.goto('fccn.pt', { viewMode: 'list' });
    await expect(urlSearchPage.listContainer).toBeVisible();

    // Exactly 5 year-groups, spanning 2015-2019 (adapted from the doc's
    // "year 1996 present, 1995 absent" — the mock has no "absent" year to
    // check since every one of its 5 fixed captures lands in a different year).
    await expect(urlSearchPage.yearAccordions).toHaveCount(5);
    for (const year of CDX_YEARS) {
        await expect(page.locator(`#list-results-year-${year}`)).toBeVisible();
    }

    // Drill into the first year: expand it, then its (only) month, then
    // confirm the specific capture underneath — mirroring the doc's
    // year -> month -> timestamp drill-down, adapted to the mock's data.
    await page.locator('#list-results-year-2015 > a').click();
    const monthLink = page.locator(`#list-results-month-${FIRST_YEAR_MONTH} > a`);
    await expect(monthLink).toBeVisible();
    await expect.soft(monthLink).toContainText('1');

    await monthLink.click();
    const timestampLink = page.locator(`#list-results-timestamp-${FIRST_TIMESTAMP} a`);
    await expect(timestampLink).toBeVisible();
    await expect.soft(timestampLink).toHaveAttribute('href', new RegExp(`/wayback/${FIRST_TIMESTAMP}/`));
});

test('shows the real fccn.pt 1996 capture correctly grouped and labelled (PT) @live', async ({ page, urlSearchPage }) => {
    await urlSearchPage.goto('fccn.pt', { viewMode: 'list', locale: 'pt' });
    await expect(urlSearchPage.listContainer).toBeVisible();

    const year1996 = page.locator('#list-results-year-1996');
    await expect(year1996).toBeVisible();
    await expect.soft(page.locator('#list-results-year-1995')).toBeHidden();

    const year1996Link = year1996.locator('a').first();
    await expect(year1996Link).toContainText('1996');
    await expect(year1996Link).toContainText('1 versão');

    await year1996Link.click();
    const october = page.locator('#list-results-month-1996-10');
    await expect(october).toContainText('Outubro');
    await expect(october).toContainText('1 versão');
    await expect.soft(page.locator('#list-results-month-1996-09')).toBeHidden();
    await expect.soft(page.locator('#list-results-month-1996-11')).toBeHidden();

    await october.locator('a').first().click();
    const timestamp = page.locator('#list-results-timestamp-19961013145650');
    await expect(timestamp).toBeVisible();
    // utils.timestampToText(t).long(...) => `${day} ${month} ${hours}h${minutes}, ${year}`
    await expect.soft(timestamp).toHaveText('13 Outubro 14h56, 1996');
    await expect.soft(timestamp.locator('a')).toHaveAttribute('href', '/wayback/19961013145650/http://www.fccn.pt/');
});

test('shows the real fccn.pt 1996 capture correctly grouped and labelled (EN) @live', async ({ page, urlSearchPage }) => {
    await urlSearchPage.goto('fccn.pt', { viewMode: 'list', locale: 'en' });
    await expect(urlSearchPage.listContainer).toBeVisible();

    const year1996 = page.locator('#list-results-year-1996');
    await expect(year1996).toBeVisible();
    await expect.soft(page.locator('#list-results-year-1995')).toBeHidden();

    const year1996Link = year1996.locator('a').first();
    await expect(year1996Link).toContainText('1996');
    await expect(year1996Link).toContainText('1 version');

    await year1996Link.click();
    const october = page.locator('#list-results-month-1996-10');
    await expect(october).toContainText('October');
    await expect(october).toContainText('1 version');
    await expect.soft(page.locator('#list-results-month-1996-09')).toBeHidden();
    await expect.soft(page.locator('#list-results-month-1996-11')).toBeHidden();

    await october.locator('a').first().click();
    const timestamp = page.locator('#list-results-timestamp-19961013145650');
    await expect(timestamp).toBeVisible();
    await expect.soft(timestamp).toHaveText('13 October 14h56, 1996');
    await expect.soft(timestamp.locator('a')).toHaveAttribute('href', '/wayback/19961013145650/http://www.fccn.pt/');
});
