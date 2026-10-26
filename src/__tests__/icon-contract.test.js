'use strict';

const fs = require('fs');
const path = require('path');

describe('Font Awesome Icon Contract Test', () => {
    const root = path.join(__dirname, '..', '..');
    const cssPath = path.join(root, 'public/vendor/css/fontawesome-all.min.css');
    const webfontsDir = path.join(root, 'public/vendor/webfonts');

    let cssContent;

    beforeAll(() => {
        cssContent = fs.readFileSync(cssPath, 'utf-8');
    });

    describe('CSS file integrity', () => {
        it('CSS file is not empty', () => {
            expect(cssContent.length).toBeGreaterThan(0);
        });

        it('references webfonts with relative path', () => {
            expect(cssContent).toContain('../webfonts/');
        });

        it('includes solid icon styles', () => {
            expect(cssContent).toContain('.fa-solid');
        });

        it('includes brand icon styles', () => {
            expect(cssContent).toContain('.fa-brands');
        });
    });

    describe('webfonts directory', () => {
        it('solid webfont exists', () => {
            expect(fs.existsSync(path.join(webfontsDir, 'fa-solid-900.woff2'))).toBe(true);
        });

        it('regular webfont exists', () => {
            expect(fs.existsSync(path.join(webfontsDir, 'fa-regular-400.woff2'))).toBe(true);
        });

        it('brands webfont exists', () => {
            expect(fs.existsSync(path.join(webfontsDir, 'fa-brands-400.woff2'))).toBe(true);
        });
    });

    describe('template wiring', () => {
        it('javascript_and_css_links.ejs loads FA via CSS link, not a JS script', () => {
            const template = fs.readFileSync(
                path.join(root, 'views/templates/javascript_and_css_links.ejs'),
                'utf-8'
            );
            expect(template).toContain('/vendor/css/fontawesome-all.min.css');
            expect(template).not.toContain('font_awesome.js');
        });
    });
});
