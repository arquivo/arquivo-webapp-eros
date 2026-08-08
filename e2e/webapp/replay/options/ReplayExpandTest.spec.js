const { test, expect } = require('../../../fixtures');

// Ported from docs/webapp/replay/options/ReplayExpandTest.md.
//
// The legacy doc's `#replayMenuButton` / `#expandPage` selectors are stale
// (leftover from a previous UI iteration). The current equivalent of
// "Expand" (no-frame view) is the right-hand options menu's "fullscreen"
// link (replayOptionsMenu.fullScreenLink, #menuFullScreen,
// views/templates/menu/replay_right_nav_menu.ejs) — its click handler in
// public/js/replay.js sends a `ReplayBarFunctions` / `ExpandClick` analytics
// event (matching the legacy feature's name), calls `e.preventDefault()`,
// then does `window.location = e.target.href`, where the href is
// `config.get('pywb.url') + '/' + requestedPage.fullUrl`. In mocked mode
// PYWB_URL points at the local mock server (e2e/mock-server/index.js),
// which answers 200 to any `/noFrame/replay/*` path, so following this
// navigation is safe and deterministic.
const WAYBACK_TIMESTAMP = '19961013145650';
const WAYBACK_SITE = 'http://www.fccn.pt/';
const WAYBACK_PATH = `/wayback/${WAYBACK_TIMESTAMP}/${WAYBACK_SITE}`;

test('expanding a replayed page navigates to the no-frame pywb view', async ({ page, replayOptionsMenu }) => {
    await page.goto(WAYBACK_PATH);

    await replayOptionsMenu.open();
    await replayOptionsMenu.fullScreenLink.click();

    // Checked against page.url() (the real browser address), not any
    // DOM/JS-exposed URL — on a replayed page document.URL would reflect
    // the archived page's original URL rather than the actual browser
    // location (mirrors the legacy doc's CustomConditions.browserUrlContains
    // note).
    await expect(page).toHaveURL(
        new RegExp(`/noFrame/replay/${WAYBACK_TIMESTAMP}/${WAYBACK_SITE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
        { timeout: 20000 },
    );
});
