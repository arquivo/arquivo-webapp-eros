const { test, expect } = require('../../fixtures');

// Ported from docs/webapp/pagesearch/PageSearchNotArchivedFileTest.md.
//
// The doc's flow clicks into the 1st/2nd/4th results and checks the wayback
// view for an absent `#pageIsNotArchived` element (or presence of
// `#replay_iframe`) to confirm the capture actually replays. Neither
// selector exists in the current templates: the replayed page's iframe
// embedding is commented out in views/templates/body/body-replay.ejs
// (`<iframe id="replay-in-iframe" ...>`) pending a pywb-side change, and
// `#replay-not-found`'s visibility is only ever toggled by the same
// (disabled) inline script. This is the same gap already documented by the
// sibling e2e/webapp/replay/ReplayTest.spec.js, so this is marked
// test.fixme() for the same reason, rather than asserting against
// selectors/behavior that don't currently run. Also depends on real
// archived-vs-gap content either way, hence @live.
test.fixme('confirms the 1st, 2nd and 4th search results replay an archived capture @live', async ({ page, pageSearchPage }) => {
    // Original intent (from docs/webapp/pagesearch/PageSearchNotArchivedFileTest.md),
    // to restore once the replay iframe is re-enabled:
    // - Search "fccn", wait for #pages-results.
    // - Click the 1st result -> wait for either #pageIsNotArchived or
    //   #replay_iframe -> assert the page is archived (only #pageIsNotArchived
    //   absent) -> navigate back.
    // - Repeat for the 2nd result, then the 4th result (3rd is deliberately
    //   skipped in the original suite, unexplained).
    await pageSearchPage.goto('fccn');
    await expect(pageSearchPage.results.first()).toBeVisible();

    await pageSearchPage.result(0).locator('.overlay-link').click();
    // await expect(page.locator('#pageIsNotArchived')).toHaveCount(0);
    await page.goBack();

    await pageSearchPage.result(1).locator('.overlay-link').click();
    // await expect(page.locator('#pageIsNotArchived')).toHaveCount(0);
    await page.goBack();

    await pageSearchPage.result(3).locator('.overlay-link').click();
    // await expect(page.locator('#pageIsNotArchived')).toHaveCount(0);
});
