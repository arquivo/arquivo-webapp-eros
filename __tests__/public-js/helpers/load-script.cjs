// Shared helper for testing the classic (non-module) browser scripts in public/js
// under the jsdom test environment (`/** @jest-environment jsdom */`).
//
// These tests live outside public/ on purpose: everything in public/ is served by
// express.static and copied into the Docker image.
//
// The extension is .cjs on purpose: jest.config.js runs every `__tests__/**/*.js`
// file as a test suite, and this file has no tests of its own.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PUBLIC_DIR = path.resolve(__dirname, '..', '..', '..', 'public');

// The copy the pages load (written to public/vendor by the postinstall script).
const JQUERY = 'vendor/js/jquery-1.12.4.js';

// Run a file from public/ in the page's global scope, close to what a <script src> tag does.
// Errors are thrown to the caller.
//
// Only top-level `function` and `var` declarations become globals (window properties).
// Top-level `const`, `let` and `class` stay private to this one load: unlike in a real
// <script>, tests and later loadScript calls can't see them. Name the ones you need in
// `globals` and they are copied onto window and returned:
//
//     const { ArquivoReplay } = loadScript('js/replay.js', { globals: ['ArquivoReplay'] });
//
// A file that starts with 'use strict' keeps even its functions and vars private, so list
// those in `globals` too.
function loadScript(publicPath, { globals = [] } = {}) {
    const file = path.join(PUBLIC_DIR, publicPath);
    const code = fs.readFileSync(file, 'utf8');
    const sourceURL = `\n//# sourceURL=${file}`;
    // Indirect eval runs in the global scope of the jsdom window.
    if (!globals.length) {
        (0, eval)(code + sourceURL);
        return {};
    }
    // The trailing expression is the eval's result, read while the bindings are in scope.
    const bindings = (0, eval)(`${code}\n;({ ${globals.join(', ')} });${sourceURL}`);
    Object.assign(window, bindings);
    return bindings;
}

// Load the vendored jQuery. Resolves once jQuery's ready callbacks have run, unless the
// document is (simulated as) still loading, in which case jQuery waits for DOMContentLoaded.
function loadJQuery() {
    loadScript(JQUERY);
    const jQuery = window.jQuery;
    if (document.readyState === 'loading') {
        return Promise.resolve(jQuery);
    }
    return new Promise((resolve) => jQuery(() => resolve(jQuery)));
}

// Record the listeners that scripts add to window and document, so a test can remove
// them afterwards and the next test starts clean. Returns the cleanup function.
function trackGlobalListeners() {
    const added = [];
    const restorers = [window, document].map((target) => {
        const ownDescriptor = Object.getOwnPropertyDescriptor(target, 'addEventListener');
        const original = target.addEventListener;
        target.addEventListener = function (type, listener, options) {
            added.push([target, type, listener, options]);
            return original.call(this, type, listener, options);
        };
        return () => {
            delete target.addEventListener;
            if (ownDescriptor) Object.defineProperty(target, 'addEventListener', ownDescriptor);
        };
    });
    return function removeTrackedListeners() {
        restorers.forEach((restore) => restore());
        added.forEach(([target, type, listener, options]) => target.removeEventListener(type, listener, options));
    };
}

// Make document.readyState report 'loading', like a script in <head> sees it.
// Returns a function that ends the simulation and fires DOMContentLoaded.
function simulateLoadingDocument() {
    Object.defineProperty(document, 'readyState', { configurable: true, get: () => 'loading' });
    return function fireDOMContentLoaded() {
        delete document.readyState;
        document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
    };
}

// Describe the tests of one public/js script twice: with the vendored jQuery on the page
// and without it. Around each test, jQuery is removed (and reloaded for the jQuery run);
// afterwards the listeners added to window/document are removed, <body> is emptied, and
// any uncaught error fails the test. The "without jQuery" run also checks that the
// script loads with no jQuery at all.
//
// `defineTests` gets:
// - `setup(html = options.html)`: put `html` in <body>, then run the script. Returns the
//   bindings named in `options.globals` (see loadScript; e.g. `ArquivoReplay`, which
//   replay.js declares as a top-level class).
// - `whileParsing()`: make the document report it is still loading, reloading jQuery so
//   its ready queue waits too. Resolves to a function that fires DOMContentLoaded.
//
// Hooks declared in `defineTests` run after this helper's own beforeEach / afterEach.
function describeScript(publicPath, options, defineTests) {
    const { html = '', globals } = options;
    const setup = (body = html) => {
        document.body.innerHTML = body;
        return loadScript(publicPath, { globals });
    };

    describe.each([
        ['with jQuery on the page', true],
        ['without jQuery', false],
    ])(`${path.basename(publicPath)} %s`, (_label, withJQuery) => {
        let removeListeners;
        let errors;

        const whileParsing = async () => {
            const fireDOMContentLoaded = simulateLoadingDocument();
            if (withJQuery) {
                await loadJQuery();
            }
            return fireDOMContentLoaded;
        };

        beforeEach(async () => {
            removeListeners = trackGlobalListeners();
            errors = [];
            window.addEventListener('error', (e) => errors.push(e.error));
            delete window.jQuery;
            delete window.$;
            if (withJQuery) {
                await loadJQuery();
            }
        });

        afterEach(() => {
            removeListeners();
            document.body.innerHTML = '';
            expect(errors).toEqual([]);
        });

        if (!withJQuery) {
            it('runs with no jQuery on the page', () => {
                expect(window.jQuery).toBeUndefined();
                expect(window.$).toBeUndefined();
                expect(() => setup()).not.toThrow();
            });
        }

        defineTests({ setup, whileParsing });
    });
}

module.exports = { describeScript, loadScript };
