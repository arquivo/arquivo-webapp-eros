'use strict';

// ESLint flat config. Deliberately small: it only enables the rules that stop
// accidental globals, undeclared names and dead variables from coming back,
// plus file-level strict mode. It does not extend `@eslint/js` recommended.

const globals = require('globals');

module.exports = [
    {
        // Generated output and third-party code.
        ignores: ['public/vendor/', 'coverage/', 'playwright-report/', 'test-results/', 'logs/', 'uploads/'],
    },
    {
        rules: {
            'no-undef': 'error',
            // `_`-prefixed arguments are kept on purpose (e.g. Express needs the
            // four-argument signature to recognise an error handler).
            'no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
            'no-implicit-globals': 'error',
            strict: ['error', 'global'],
        },
    },
    {
        // Server, scripts, configs, Jest tests and Playwright specs: CommonJS on Node.
        files: ['**/*.js', '**/*.cjs'],
        ignores: ['public/js/**'],
        languageOptions: { sourceType: 'commonjs', globals: globals.node },
    },
    {
        files: ['**/__tests__/**', '__mocks__/**'],
        languageOptions: { globals: globals.jest },
    },
    {
        // Browser script tests run in jsdom; callbacks passed to page.evaluate() and
        // friends in the Playwright specs run in the browser.
        files: ['__tests__/public-js/**', 'e2e/**'],
        languageOptions: { globals: globals.browser },
    },
    {
        // Classic browser scripts loaded with <script> tags (no bundler).
        // Names a file shares with templates or other scripts are listed in a
        // `/* exported */` comment in that file; names it uses from them are
        // listed in a `/* global */` comment.
        files: ['public/js/**/*.js'],
        languageOptions: { sourceType: 'script', globals: { ...globals.browser, ...globals.jquery } },
    },
];
