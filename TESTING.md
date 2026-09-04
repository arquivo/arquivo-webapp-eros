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

```bash
# First-time setup: install browser binaries
npx playwright install --with-deps chromium

# Run the full suite (mocked mode, all browser projects)
npm run test:e2e

# Run a single browser project (matches the CI job)
npm run test:e2e -- --project=chromium
# other projects: firefox, webkit, "Mobile Chrome", "Mobile Safari"

# Run a single spec file
npx playwright test e2e/webapp/pagesearch/PageSearchTest.spec.js --project=chromium

# Run in live mode (real preprod, @live-tagged tests only)
npm run test:e2e:live

# Interactive UI mode, useful while writing/debugging specs
npx playwright test --ui
```

A cross-browser run (Windows/macOS × Chrome/Firefox/Safari) is also wired up via Sauce Labs
(`.sauce/config.yml`), triggered manually or on a daily schedule — see
`.github/workflows/e2e-sauce.yml`.

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
