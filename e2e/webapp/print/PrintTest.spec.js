const { test, expect } = require('../../fixtures');
const crypto = require('crypto');

// Ported from docs/webapp/print/PrintTest.md.
//
// Pure HTTP checksum check, no browser/WebDriver in the original Java suite
// either. There is no `/screenshot` route anywhere in this repo's Express
// app (checked src/router.js and src/backend-routes.js) - it only exists on
// the real deployed environment, presumably proxied by infrastructure
// outside this app. So this can't be mocked at all: it hits a hardcoded,
// absolute real-preprod URL directly via Playwright's built-in `request`
// fixture, bypassing baseURL entirely.
//
// The legacy suite's comment: "md5 sometimes is c65787ae..., other times
// it's 223b57dd..., no idea why, so we check for both" - kept as-is here.
const SCREENSHOT_URL =
    'https://preprod.arquivo.pt/screenshot?url=https://preprod.arquivo.pt/noFrame/replay/19961013145650/http://www.fccn.pt/&download=false';
const ACCEPTED_MD5S = ['c65787ae99ea0e04848ed324e790cf49', '223b57dd7543af7b094ec4c5b9d45dc4'];

test('print output md5 matches a known-good checksum @live', async ({ request, mode }) => {
    test.skip(mode !== 'live', 'HTTP-only checksum check against real preprod; no /screenshot route exists locally or in mocked mode');

    const response = await request.get(SCREENSHOT_URL);
    const body = await response.body();
    const md5 = crypto.createHash('md5').update(body).digest('hex');

    expect(ACCEPTED_MD5S).toContain(md5);
});
