const { test, expect } = require('../../../fixtures');

// Ported from docs/webapp/replay/options/ReplayTechnicalDetailsTest.md.
//
// The legacy doc's `#replayMenuButton`, `#a_moreinfo > h4:nth-child(1)`,
// `#uglipop_popbox` and `#removeModal` selectors are all stale (leftover
// from a previous UI iteration). Current equivalents:
// replayOptionsMenu.technicalDetailsLink (#menuTechnicalDetails) opens
// technicalDetailsModal.modal (#technical-details.modal,
// views/partials/replay-technical-details.ejs), which server-renders one
// `<li class="technical-details-row" data-key="<field>">` per key present
// in the capture's API metadata (`apiData`) — technicalDetailsModal.row(key)
// locates each by its data-key attribute — and is closed via
// technicalDetailsModal.close() (.close.cancel button).
//
// The legacy doc's ~15 hardcoded field values (digest, offset, fileName,
// statusCode, exact derived-link URLs) are tied to one specific real
// archived capture (collection "Roteiro") and aren't reproducible against
// the mock server, whose canned metadata record
// (e2e/mock-server/fixtures.js#buildMetadataResult) only exposes: title,
// originalURL, collection, mimeType, contentLength, digest, tstamp,
// encoding — echoing back the requested url/timestamp, with no
// offset/fileName/statusCode/derived-link fields. So:
// - The first (mocked-mode) test below verifies the modal's mechanics and
//   the fields the mock *does* provide, matching what was requested.
// - A second, `@live`-tagged test asserts the exact legacy hardcoded values
//   against real preprod content; it can't be verified from this sandbox
//   (no network access to preprod) but mirrors the doc's original
//   expectations for when it's run via `npm run test:e2e:live`.
//
// Verified quirk (as of this writing): the whole `<script src="/js/replay.js">`
// bootstrap in views/templates/body/body-replay.ejs is HTML-commented-out
// (since commit 6285390, alongside disabling the archived-page iframe), so
// the shared `.modal button.cancel` handler it defines — which
// technicalDetailsModal.close() relies on (`.close.cancel`) — is currently a
// no-op. technicalDetailsModal.close() falls back to Escape (jquery-modal
// core's own close path, independent of replay.js) whenever the click alone
// doesn't hide the modal, so the modal reliably ends up closed either way.
const WAYBACK_TIMESTAMP = '19961013145650';
const WAYBACK_SITE = 'http://www.fccn.pt/';
const WAYBACK_EXAMPLE = `/wayback/${WAYBACK_TIMESTAMP}/${WAYBACK_SITE}`;

test('technical details modal shows the requested capture metadata and closes', async ({ page, replayOptionsMenu, technicalDetailsModal }) => {
    await page.goto(WAYBACK_EXAMPLE);

    await replayOptionsMenu.open();
    await replayOptionsMenu.technicalDetailsLink.click();

    await expect(technicalDetailsModal.modal).toBeVisible();

    await expect.soft(technicalDetailsModal.row('originalURL')).toContainText(WAYBACK_SITE);
    await expect.soft(technicalDetailsModal.row('tstamp')).toContainText(WAYBACK_TIMESTAMP);
    await expect.soft(technicalDetailsModal.row('mimeType')).toContainText('text/html');
    await expect.soft(technicalDetailsModal.row('collection')).toContainText('MockCollection');

    await technicalDetailsModal.close();
    await expect(technicalDetailsModal.modal).toBeHidden();
});

test('technical details modal shows exact capture metadata for the FCCN 1996 snapshot @live', async ({ page, replayOptionsMenu, technicalDetailsModal }) => {
    await page.goto(WAYBACK_EXAMPLE);

    await replayOptionsMenu.open();
    await replayOptionsMenu.technicalDetailsLink.click();

    await expect(technicalDetailsModal.modal).toBeVisible();

    // Hardcoded expectations carried over from the legacy Selenium suite for
    // this specific real archived capture (collection "Roteiro"). The
    // original doc's `anyOf(...)` alternatives between the legacy
    // (W)ARC-index backend and Solr are preserved as regex alternation.
    // Only verifiable by actually running against preprod (`npm run
    // test:e2e:live`) — cannot be exercised from this sandbox.
    await expect.soft(technicalDetailsModal.row('originalURL')).toContainText('fccn.pt');
    await expect.soft(technicalDetailsModal.row('tstamp')).toContainText(WAYBACK_TIMESTAMP);
    await expect.soft(technicalDetailsModal.row('contentLength')).toContainText(/3760|1373/);
    await expect.soft(technicalDetailsModal.row('digest')).toContainText(
        /b5f96e1014f99bbd9ef0277cde883f37|OWMAVER7CCNJWL2E5ZURDDKGCHWS7JJO/,
    );
    await expect.soft(technicalDetailsModal.row('mimeType')).toContainText('text/html');
    await expect.soft(technicalDetailsModal.row('fileName')).toContainText('AWP-Roteiro-20090510220155-00000');
    await expect.soft(technicalDetailsModal.row('collection')).toContainText('Roteiro');
    await expect.soft(technicalDetailsModal.row('offset')).toContainText('45198');
    await expect.soft(technicalDetailsModal.row('statusCode')).toContainText('200');

    await technicalDetailsModal.close();
    await expect(technicalDetailsModal.modal).toBeHidden();
});
