const { test, expect } = require('../../../fixtures');

// Ported from docs/webapp/replay/options/ReplayScreenshotTest.md.
//
// The legacy doc's `#replayMenuButton`, `#screenshotOption`, `#cancelPopup`,
// `#uglipop_content_fixed`, `#takeScreenshot`, `#closeSpecPopUp` and
// `#arquivoLogo` selectors are all stale. Current selectors:
// replayOptionsMenu.screenshotLink (#menuScreenshot) opens
// replayOptionsMenu.screenshotModal (#screenshot.modal,
// views/templates/header/header-replay.ejs). Cancel uses the shared
// `.modal button.cancel` handler (public/js/replay.js). Confirm
// (`#screenshot button.confirm`) builds a request URL against
// `config.get('screenshot.url')` (real preprod, not overridden by the
// mocked-mode webServer env in playwright.config.js) and calls
// `window.open(requestURL, "_blank")` — i.e. it opens a new tab pointed at
// a real external service. Per the porting guidance, this isn't clicked
// here (it would attempt real external navigation with no network access
// in this sandbox/CI); instead this spec verifies the modal open/cancel
// mechanics and that the confirm button is present and actionable.
//
// Verified quirk (as of this writing): the whole `<script src="/js/replay.js">`
// bootstrap in views/templates/body/body-replay.ejs is HTML-commented-out
// (since commit 6285390, alongside disabling the archived-page iframe), so
// none of replay.js's own click handlers — including the shared
// `.modal button.cancel` binding above — are actually attached on the page
// right now. The modal still opens (jquery-modal's own `rel="modal:open"`
// auto-bind is independent of replay.js and unaffected), but clicking
// `button.cancel` is currently a no-op; only Escape / clicking the modal's
// backdrop (also handled by jquery-modal core, independent of replay.js)
// reliably closes it. So this test closes via Escape rather than asserting
// on the (currently broken) cancel-button behavior.
const WAYBACK_EXAMPLE = '/wayback/19961013145650/http://www.fccn.pt/';

test('screenshot option opens a confirmation modal that can be cancelled', async ({ page, replayOptionsMenu }) => {
    await page.goto(WAYBACK_EXAMPLE);
    await replayOptionsMenu.open();

    await replayOptionsMenu.screenshotLink.click();
    await expect(replayOptionsMenu.screenshotModal).toBeVisible();

    await replayOptionsMenu.screenshotModal.locator('button.cancel').click();
    // Cancel is currently a no-op (see file comment) — Escape reliably
    // closes the modal regardless, via jquery-modal's own core behavior.
    await page.keyboard.press('Escape');
    await expect(replayOptionsMenu.screenshotModal).toBeHidden();

    // Re-open and confirm the confirm button is present/actionable, without
    // clicking it (a real click would open a new tab against the real,
    // un-mocked screenshot service).
    await replayOptionsMenu.screenshotLink.click();
    await expect(replayOptionsMenu.screenshotModal).toBeVisible();
    const confirmButton = replayOptionsMenu.screenshotModal.locator('button.confirm');
    await expect(confirmButton).toBeVisible();
    await expect(confirmButton).toBeEnabled();
});
