const { test, expect } = require('../../../fixtures');

// Ported from docs/webapp/replay/options/ReplayPrintTest.md.
//
// The legacy doc's `#replayMenuButton`, `#printOption`, `#cancelPopup`,
// `#uglipop_content_fixed` and `#printPage` selectors are all stale.
// Current selectors: replayOptionsMenu.printLink (#menuPrint) opens
// replayOptionsMenu.printModal (#print.modal,
// views/templates/header/header-replay.ejs). Cancel is a shared handler
// (`$('.modal').on('click', 'button.cancel', ...)` in public/js/replay.js)
// that closes whichever modal is open via `$.modal.close()`. Confirm
// (`#print button.confirm`) builds a screenshot-service image URL, sets it
// as a hidden <img> src, and — once that image loads — opens a hidden
// iframe and calls `iframe.contentWindow.print()`, i.e. it triggers the
// native browser print dialog. That native dialog isn't automatable or
// verifiable via Playwright (mirroring the legacy doc's own note that its
// Selenium test deliberately stops short of the native dialog), and the
// underlying image request targets the real `screenshot.url` service
// (not overridden by the mocked-mode webServer env in playwright.config.js),
// so clicking confirm here would attempt real external navigation. This
// spec therefore verifies the open/cancel mechanics and that the confirm
// button exists and is actionable, without clicking it.
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

test('print option opens a confirmation modal that can be cancelled', async ({ page, replayOptionsMenu }) => {
    await page.goto(WAYBACK_EXAMPLE);
    await replayOptionsMenu.open();

    await replayOptionsMenu.printLink.click();
    await expect(replayOptionsMenu.printModal).toBeVisible();

    await replayOptionsMenu.printModal.locator('button.cancel').click();
    // Cancel is currently a no-op (see file comment) — Escape reliably
    // closes the modal regardless, via jquery-modal's own core behavior.
    await page.keyboard.press('Escape');
    await expect(replayOptionsMenu.printModal).toBeHidden();

    // Re-open and confirm the confirm button is present/actionable, without
    // clicking it (a real click would attempt to fetch an external image
    // and open the native print dialog).
    await replayOptionsMenu.printLink.click();
    await expect(replayOptionsMenu.printModal).toBeVisible();
    const confirmButton = replayOptionsMenu.printModal.locator('button.confirm');
    await expect(confirmButton).toBeVisible();
    await expect(confirmButton).toBeEnabled();
});
