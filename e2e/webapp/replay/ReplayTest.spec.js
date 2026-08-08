const { test, expect } = require('../../fixtures');

// The replayed page's iframe embedding is commented out in
// views/templates/body/body-replay.ejs (`<iframe id="replay-in-iframe" ...>`
// pending a pywb-side change), so this smoke test — which asserts on text
// read from inside that iframe — cannot pass yet in either mocked or live
// mode. Marked test.fixme() to preserve the original intent without
// asserting against code that doesn't run.
test.fixme('replays several 1996 archived pages and shows page-specific text @live', async ({ page }) => {
    // Original intent (from docs/webapp/replay/ReplayTest.md), to restore once the iframe is re-enabled:
    // - /wayback/19961013145650/http://www.fccn.pt/ → #replay_iframe text at
    //   `body > blockquote:nth-child(5) > h1 > a` contains 'rccn'
    // - /wayback/19961013171554/http://www.fccn.pt/index_i.html → #replay_iframe text at
    //   `body > b:nth-child(12)` contains 'portuguese'
    // - /wayback/19961013145852/http://s700.uminho.pt:80/homepage-pt.html → #replay_iframe text at
    //   `body > center:nth-child(1) > h1` contains 'portugal'
    // - /wayback/19961013202814/http://www.iscte.pt/ → #replay_iframe text at
    //   `body > center:nth-child(3) > table > tbody > tr > td:nth-child(1) > h1 > center` contains 'iscte'
    // - /wayback/19961013171626/http://www.ist.utl.pt/ → #replay_iframe text at
    //   `body > p:nth-child(3) > b` contains 'ist'
});
