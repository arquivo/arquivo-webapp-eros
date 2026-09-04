const { test, expect } = require('../../fixtures');
const crypto = require('crypto');

// Ported from docs/webapp/screenshot/ScreenshotTest.md.
//
// Pure HTTP checksum check, no browser/WebDriver in the original Java suite
// either. There is no `/screenshot` route anywhere in this repo's Express
// app (checked src/router.js and src/backend-routes.js) - it only exists on
// the real deployed environment, presumably proxied by infrastructure
// outside this app. So this can't be mocked at all: it hits a hardcoded,
// absolute real-preprod URL directly via Playwright's built-in `request`
// fixture, bypassing baseURL entirely.
//
// Unlike the sibling PrintTest, only a single exact MD5 is accepted here
// (no dual-hash tolerance) - kept as-is from the legacy doc.
const SCREENSHOT_URL =
    'https://preprod.arquivo.pt/screenshot/?url=https://preprod.arquivo.pt/noFrame/replay/19961013145650/http://www.fccn.pt/&width=2560&height=1440';
const EXPECTED_MD5 = '223b57dd7543af7b094ec4c5b9d45dc4';

test('screenshot image md5 matches the known-good checksum @live', async ({ request, mode }) => {
    test.skip(mode !== 'live', 'HTTP-only checksum check against real preprod; no /screenshot route exists locally or in mocked mode');

    const response = await request.get(SCREENSHOT_URL);
    const body = await response.body();
    const md5 = crypto.createHash('md5').update(body).digest('hex');

    expect(md5).toBe(EXPECTED_MD5);
});
