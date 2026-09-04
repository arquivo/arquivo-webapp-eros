const { test, expect } = require('../../fixtures');

// Ported from docs/webapp/urlsearch/URLSearchListNotContainsSomeHttpCodesTest.md.
//
// This test is fundamentally about the list view filtering out captures
// with error/redirect HTTP status codes (404/403/406/503/302) while keeping
// legitimate 200 captures nearby in time. The mock CDX endpoint
// (e2e/mock-server/index.js handleCdx -> buildCdxResults, see also
// e2e/mock-server/fixtures.js) always returns a fixed set of 5 captures,
// ALL status 200, regardless of which url is requested or which query
// params are sent — it has no notion of a "bad" capture to filter, and
// extending it is out of scope for this port (mock-server files are not to
// be edited). So there is no way to reproduce a "some captures get filtered
// by status" scenario against the current mock; every test below is tagged
// @live and asserts against the exact real preprod data described in the doc.
//
// Note on "visible"/"invisible": captures with filtered-out status codes are
// dropped server-side, not merely CSS-collapsed — every year/month accordion
// in views/partials/url-list-results.ejs is collapsed by default (see
// public/css/styles.css `.panel { max-height: 0; overflow: hidden; }`) until
// clicked open. So "the good capture is present" is checked via
// toBeAttached() (it exists in the rendered list, expanded or not) rather
// than toBeVisible(), matching the doc's "wait for presence" semantics
// rather than requiring the accordions to be expanded first.

const LIST_LABEL = { pt: 'Lista', en: 'List' };

const CASES = [
    {
        name: 'filters out a 406 capture (PT)',
        url: 'http://www.caleida.pt/saramago/',
        locale: 'pt',
        visible: '19980205082901',
        invisible: '20120131163447',
    },
    {
        name: 'filters out a 404 capture (EN)',
        url: 'http://www.caleida.pt/saramago/',
        locale: 'en',
        visible: '20000413142115',
        invisible: '20160210151550',
    },
    {
        name: 'filters out a 403 capture (PT)',
        url: 'sapo.pt',
        locale: 'pt',
        visible: '19971210144509',
        invisible: '20150424043204',
    },
    {
        name: 'filters out a 503 capture (EN)',
        url: 'record.pt',
        locale: 'en',
        visible: '19981202152653',
        invisible: '20171031183600',
    },
    {
        name: 'filters out a 302 capture (PT)',
        url: 'fccn.pt',
        locale: 'pt',
        visible: '20090904173659',
        invisible: '20161213184117',
    },
    {
        name: 'filters out a 302 capture (EN)',
        url: 'fccn.pt',
        locale: 'en',
        visible: '20090904173659',
        invisible: '20161213184117',
    },
];

for (const { name, url, locale, visible, invisible } of CASES) {
    test(`${name} from the version list @live`, async ({ page, urlSearchPage }) => {
        await urlSearchPage.goto(url, { viewMode: 'list', locale });

        // "List button is available" — localized list-toggle label.
        await expect(page.locator('#replay-list-button')).toContainText(LIST_LABEL[locale]);

        // "The timestamp %s for %s should be presented" (hard).
        await expect(page.locator(`#list-results-timestamp-${visible}`)).toBeAttached();
        // "The timestamp %s for %s should not exist" (soft).
        await expect.soft(page.locator(`#list-results-timestamp-${invisible}`)).not.toBeAttached();
    });
}
