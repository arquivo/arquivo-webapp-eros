const base = require('@playwright/test');
const { SearchBar } = require('./pages/SearchBar');
const { PageSearchPage } = require('./pages/PageSearchPage');
const { ImageSearchPage } = require('./pages/ImageSearchPage');
const { AdvancedSearchPage } = require('./pages/AdvancedSearchPage');
const { MenuPage } = require('./pages/MenuPage');
const { ReplayOptionsMenu } = require('./pages/ReplayOptionsMenu');
const { TechnicalDetailsModal } = require('./pages/TechnicalDetailsModal');
const { UrlSearchPage } = require('./pages/UrlSearchPage');

/**
 * Custom test object wiring page objects as fixtures, and exposing which
 * mode (mocked/live) the suite is running under so specs can branch or
 * skip (see the `mode` fixture and the `@live` tag convention).
 */
const test = base.test.extend({
    mode: async ({}, use) => {
        await use(process.env.E2E_MODE === 'live' ? 'live' : 'mocked');
    },
    // Stub `gtag` as a no-op before any app script runs. Several call sites
    // (public/js/search-tools.js, exports.js, navigation-tools.ejs) still call
    // `gtag(...)` directly, but the GA4 bootstrap in
    // views/templates/javascript_and_css_links.ejs only defines `ga4()` — the
    // bridging `gtag` shim was removed in commit 98807e8 without updating
    // those call sites, so `gtag` is undefined whenever it's reachable at all
    // (e.g. when googletagmanager.com's script is blocked/unreachable, as in
    // this sandbox) and throws, aborting the handler it's called from. This
    // is a real app bug (flagged separately), independent of stubbing gtag
    // here, which is standard e2e practice regardless.
    page: async ({ page }, use) => {
        await page.addInitScript(() => {
            window.gtag = window.gtag || function () {};
        });
        await use(page);
    },
    searchBar: async ({ page }, use) => {
        await use(new SearchBar(page));
    },
    pageSearchPage: async ({ page }, use) => {
        await use(new PageSearchPage(page));
    },
    imageSearchPage: async ({ page }, use) => {
        await use(new ImageSearchPage(page));
    },
    advancedSearchPage: async ({ page }, use) => {
        await use(new AdvancedSearchPage(page));
    },
    menuPage: async ({ page }, use) => {
        await use(new MenuPage(page));
    },
    replayOptionsMenu: async ({ page }, use) => {
        await use(new ReplayOptionsMenu(page));
    },
    technicalDetailsModal: async ({ page }, use) => {
        await use(new TechnicalDetailsModal(page));
    },
    urlSearchPage: async ({ page }, use) => {
        await use(new UrlSearchPage(page));
    },
});

const expect = base.expect;

module.exports = { test, expect };
