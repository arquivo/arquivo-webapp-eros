const { test, expect } = require('../../fixtures');
const { default: AxeBuilder } = require('@axe-core/playwright');

// WCAG 2.1 AA colour contrast (axe rule `color-contrast`, SC 1.4.3), checked in
// a real browser. The jest-axe suite (src/__tests__/accessibility.test.js) runs
// in jsdom, which has no layout or computed styles, so axe can never evaluate
// contrast there — this spec covers that gap (#68).
//
// Result pages are audited after their results are fetched and rendered client
// side, so the colours of the actual result cards are checked, not just the
// page shell.

const PAGES = [
    { name: 'homepage', path: '/' },
    { name: 'page search landing', path: '/pages' },
    { name: 'image search landing', path: '/images' },
    { name: 'page search results', path: '/page/search?q=fccn', ready: '.page-search-result' },
    { name: 'image search results', path: '/image/search?q=fccn', ready: '.image-card' },
    { name: 'URL search results', path: '/url/search?q=fccn.pt', ready: '.menu-pages-replay-year' },
    { name: 'advanced page search', path: '/page/advanced/search' },
    { name: 'advanced image search', path: '/image/advanced/search' },
    { name: 'archive page now', path: '/services/archivepagenow' },
    { name: 'citation saver', path: '/services/citationsaver' },
];

// One line per failing node: selector, colours and ratio, as reported by axe.
function describeViolations(violations) {
    return violations.flatMap((v) => v.nodes.map((node) => {
        const data = node.any[0]?.data ?? {};
        return `${node.target.join(' ')} — ${data.fgColor} on ${data.bgColor} = ${data.contrastRatio}:1 (needs ${data.expectedContrastRatio})`;
    }));
}

for (const { name, path, ready } of PAGES) {
    test(`${name} (${path}) meets WCAG 2.1 AA colour contrast`, async ({ page }) => {
        await page.goto(path);
        if (ready) {
            await page.locator(ready).first().waitFor();
        }

        const results = await new AxeBuilder({ page })
            .withRules(['color-contrast'])
            .analyze();

        expect(describeViolations(results.violations)).toEqual([]);
    });
}
