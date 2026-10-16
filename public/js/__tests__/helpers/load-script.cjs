// Shared helper for testing the classic (non-module) browser scripts in public/js
// under the jsdom test environment (`/** @jest-environment jsdom */`).
//
// The extension is .cjs on purpose: jest.config.js runs every `__tests__/**/*.js`
// file as a test suite, and this file has no tests of its own.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PUBLIC_DIR = path.resolve(__dirname, '..', '..', '..');

// The copy the pages load (written to public/vendor by the postinstall script).
const JQUERY = 'vendor/js/jquery-1.12.4.js';

// Run a file from public/ in the page's global scope, the way a <script src> tag does:
// top-level declarations become globals. Errors are thrown to the caller.
function loadScript(publicPath) {
    const file = path.join(PUBLIC_DIR, publicPath);
    const code = fs.readFileSync(file, 'utf8');
    // Indirect eval runs in the global scope of the jsdom window.
    (0, eval)(`${code}\n//# sourceURL=${file}`);
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

module.exports = { loadScript, loadJQuery, trackGlobalListeners, simulateLoadingDocument };
