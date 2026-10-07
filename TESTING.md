# Testing Documentation

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Accessibility Tests (WCAG 2.1 AA)

```bash
# Run accessibility tests (7 pass / 6 fail until violations #68–#70 are fixed)
npm run test:a11y
```

## End-to-End Tests (Playwright)

Functional tests live under `e2e/webapp/`, mirroring the pages/flows they cover (search, image search,
replay, menus, url search, etc.). They run in two modes:

- **Mocked mode (default)** — boots a fixture HTTP server plus the app itself, so tests run against
  canned data: fast, deterministic, no dependency on real archived content. This is what CI runs on every PR.
- **Live mode** — points at real `preprod.arquivo.pt`. Used only for the handful of specs tagged `@live`
  that need genuine archived content (search relevance, spam/dedup, spell-suggestion, real replay
  snapshots). Not run in CI by default.

### First-time setup

`npm ci` only installs the `@playwright/test` package — it does **not** download the browser binaries
or the OS libraries they need. Install those once per machine (and again after upgrading
`@playwright/test`):

```bash
# All browser projects (needed for a plain `npm run test:e2e`)
npx playwright install --with-deps

# Or just Chromium, if you only run the CI-equivalent project
npx playwright install --with-deps chromium
```

`--with-deps` installs the system libraries via `apt` and will prompt for `sudo`.

If you skip this step, or install only Chromium and then run every project, the run fails with:

```
Error: browserType.launch:
Host system is missing dependencies to run browsers.
Please install them with the following command:
    sudo npx playwright install-deps
```

(or `Executable doesn't exist at ~/.cache/ms-playwright/...` when the browser binary itself is missing).
To fix it, run the `install --with-deps` command above for the projects you want to run. If you'd rather
not run `apt` through `npx`, install the packages listed in the error message (e.g.
`sudo apt-get install libavif16`, which WebKit needs on Ubuntu 24.04).

### Running

```bash
# Run the full suite (mocked mode, all browser projects — requires all browsers installed)
npm run test:e2e

# Run a single spec file
npx playwright test e2e/webapp/pagesearch/PageSearchTest.spec.js --project=chromium

# Run in live mode (real preprod, @live-tagged tests only)
npm run test:e2e:live

# Interactive UI mode, useful while writing/debugging specs
npx playwright test --ui

# Open the HTML report of the last run
npx playwright show-report
```

### Running specific browsers

Each browser is a Playwright *project* defined in `playwright.config.js`. Without `--project`, all
of them run.

| Project         | Engine   | Emulated device | Install with                            |
|-----------------|----------|-----------------|-----------------------------------------|
| `chromium`      | Chromium | Desktop Chrome  | `npx playwright install --with-deps chromium` |
| `firefox`       | Firefox  | Desktop Firefox | `npx playwright install --with-deps firefox`  |
| `webkit`        | WebKit   | Desktop Safari  | `npx playwright install --with-deps webkit`   |
| `Mobile Chrome` | Chromium | Pixel 7         | `npx playwright install --with-deps chromium` |
| `Mobile Safari` | WebKit   | iPhone 14       | `npx playwright install --with-deps webkit`   |

The mobile projects reuse the desktop engines with a mobile viewport, user agent and touch, so you
only ever need the three engines. "Safari" here means Playwright's WebKit build, not Apple's Safari.

```bash
# One project (chromium is what CI runs)
npm run test:e2e -- --project=chromium

# Several projects: repeat the flag; quote names that contain spaces
npm run test:e2e -- --project=firefox --project=webkit
npm run test:e2e -- --project="Mobile Chrome" --project="Mobile Safari"

# All desktop or all mobile projects (--project accepts wildcards)
npm run test:e2e -- --project=chromium --project=firefox --project=webkit
npm run test:e2e -- --project="Mobile*"

# One spec on one browser, with a visible browser window
npm run test:e2e -- e2e/webapp/menu/MenuPagesNewSearchHomepageTest.spec.js --project=firefox --headed

# Step through a spec in the Playwright inspector
npm run test:e2e -- e2e/webapp/menu/MenuPagesNewSearchHomepageTest.spec.js --project=webkit --debug

# Behave like CI (2 retries, test.only forbidden)
CI=1 npm run test:e2e -- --project=chromium
```

The `--` passes the remaining arguments through `npm run` to `playwright test`. With `npx playwright
test ...` you can drop it. Some specs call `test.skip(isMobile, ...)` because the mobile date picker is
a different widget, so the mobile projects report more skipped tests. That is expected.

A cross-browser run on real Windows/macOS browsers via Sauce Labs is configured in
`.sauce/config.yml` and `.github/workflows/e2e-sauce.yml`. That workflow is currently **disabled**
(commented out) until the `SAUCE_USERNAME`/`SAUCE_ACCESS_KEY` repo secrets are added. Once you have
credentials, you can start it locally with `npm run test:e2e:sauce`, which needs the
[`saucectl`](https://docs.saucelabs.com/dev/cli/saucectl/) CLI installed (it is not an npm dependency
of this project).

## Local SonarQube Analysis

Run the same analysis that SonarCloud runs on PRs, without pushing:

```bash
SONAR_TOKEN=your-token npm run sonar
```

Get your token at https://sonarcloud.io/account/security (My Account → Security → Generate Token).

To avoid typing the token every time, add it to your shell profile (`~/.bashrc` or `~/.zshrc`):

```bash
export SONAR_TOKEN=your-token
```

Then just run:

```bash
npm run sonar
```

> **Never commit the token** — do not add it to `.env`, `sonar-project.properties`, or any file tracked by git.

## Coverage Thresholds

The project requires minimum coverage thresholds (configured in jest.config.js).
- Statements: 50%
- Branches: 50%
- Functions: 50%
- Lines: 50%

Current overall coverage is below these thresholds. Add more tests to increase coverage!
