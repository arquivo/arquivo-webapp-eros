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
