'use strict';

const fs = require('fs');
const path = require('path');

describe('Font Awesome Icon Contract Test', () => {
    let kitJs;

    beforeAll(() => {
        const jsPath = path.join(__dirname, '../../public/vendor/js/font_awesome.js');
        kitJs = fs.readFileSync(jsPath, 'utf-8');
    });

    describe('Font Awesome Kit JS integrity', () => {
        it('JS file is not empty', () => {
            expect(kitJs.length).toBeGreaterThan(0);
        });

        it('contains FontAwesomeKitConfig', () => {
            expect(kitJs).toContain('FontAwesomeKitConfig');
        });

        it('uses CSS delivery method', () => {
            expect(kitJs).toMatch(/\bmethod\s*:\s*"css"/);
        });

        it('loads icons synchronously (asyncLoading disabled)', () => {
            expect(kitJs).toMatch(/asyncLoading\s*:\s*\{[^}]*enabled\s*:\s*false/);
        });

        it('includes v4 shim for backward-compatible fa- class names', () => {
            expect(kitJs).toMatch(/v4shim\s*:\s*\{[^}]*enabled\s*:\s*true/);
        });

        it('includes v4 font-face shim', () => {
            expect(kitJs).toMatch(/v4FontFaceShim\s*:\s*\{[^}]*enabled\s*:\s*true/);
        });

        it('targets Font Awesome 5 version', () => {
            expect(kitJs).toMatch(/\bversion\s*:\s*"5\./);
        });

        it('uses free license', () => {
            expect(kitJs).toMatch(/\blicense\s*:\s*"free"/);
        });

        it('has a kit token configured', () => {
            expect(kitJs).toMatch(/\btoken\s*:\s*"\w+"/);
        });

        it('enables auto-accessibility attributes', () => {
            expect(kitJs).toMatch(/autoA11y\s*:\s*\{[^}]*enabled\s*:\s*true/);
        });
    });
});
