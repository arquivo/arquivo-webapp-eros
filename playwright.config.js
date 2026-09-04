// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const MOCK_SERVER_PORT = process.env.MOCK_SERVER_PORT || 4100;
const MOCK_SERVER_URL = `http://localhost:${MOCK_SERVER_PORT}`;
const APP_PORT = 3000;
const APP_URL = `http://localhost:${APP_PORT}`;

/**
 * Two run modes, selected via E2E_MODE:
 * - "mocked" (default): boots e2e/mock-server alongside the app and points
 *   every backend-derived config key at it. Fast, deterministic, used for
 *   PR-blocking CI.
 * - "live": points the app at the real preprod backend. Used for @live
 *   specs that depend on real archived content (npm run test:e2e:live).
 */
const mode = process.env.E2E_MODE === 'live' ? 'live' : 'mocked';

const mockedBackendEnv = {
    BACKEND_URL: MOCK_SERVER_URL,
    WAYBACK_URL: `${MOCK_SERVER_URL}/wayback`,
    PYWB_URL: `${MOCK_SERVER_URL}/noFrame/replay`,
    TEXT_SEARCH_API_SOLR: `${MOCK_SERVER_URL}/textsearch`,
    TEXT_SEARCH_API_NUTCHWAX: `${MOCK_SERVER_URL}/textsearchnutchwax`,
    TEXT_SEARCH_API_DEFAULT: `${MOCK_SERVER_URL}/textsearch`,
    IMAGE_SEARCH_API: `${MOCK_SERVER_URL}/imagesearch`,
    CDX_API: `${MOCK_SERVER_URL}/wayback/cdx`,
    SERVICES_ARCHIVEPAGENOW_URL: `${MOCK_SERVER_URL}/save/now/record/`,
};

const webServer = mode === 'mocked'
    ? [
        {
            command: 'node e2e/mock-server/index.js',
            url: `${MOCK_SERVER_URL}/textsearch`,
            reuseExistingServer: !process.env.CI,
            env: { MOCK_SERVER_PORT: String(MOCK_SERVER_PORT) },
        },
        {
            command: 'node server.js',
            url: APP_URL,
            reuseExistingServer: !process.env.CI,
            env: mockedBackendEnv,
        },
    ]
    : [
        {
            command: 'node server.js',
            url: APP_URL,
            reuseExistingServer: !process.env.CI,
        },
    ];

module.exports = defineConfig({
    testDir: './e2e/webapp',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? [['html'], ['github']] : 'html',
    use: {
        baseURL: APP_URL,
        trace: 'on-first-retry',
    },
    grepInvert: mode === 'live' ? undefined : /@live/,
    grep: mode === 'live' ? /@live/ : undefined,
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
        { name: 'Mobile Chrome', use: { ...devices['Pixel 7'] } },
        { name: 'Mobile Safari', use: { ...devices['iPhone 14'] } },
    ],
    webServer,
});
