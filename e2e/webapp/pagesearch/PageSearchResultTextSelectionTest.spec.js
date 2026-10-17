const { test, expect } = require('../../fixtures');

// public/js/page-search-results.js lets the user select the text of a result card even
// though a full-card overlay link (a.overlay-link) sits on top of it, and only follows
// the link for a short click (300 ms or less from press to click). The results are
// AJAX-loaded into #pages-results after the script runs, so this also checks that its
// delegated handlers reach them.

test.describe('page search result text selection', () => {
    test('dragging over a result selects its text and does not follow the link', async ({ page, pageSearchPage, isMobile }) => {
        test.skip(isMobile, 'selecting text with a mouse drag is a desktop interaction');

        await pageSearchPage.goto('fccn');
        const summary = pageSearchPage.result(0).locator('.results-summary');
        await expect(summary).toBeVisible();

        // Whether each click on an overlay link was cancelled, read once the click has been
        // dispatched, and every /page/view/ navigation the page starts.
        await page.evaluate(() => {
            window.overlayClicks = [];
            window.addEventListener('click', (e) => {
                if (e.target.closest('a.overlay-link')) {
                    setTimeout(() => window.overlayClicks.push(e.defaultPrevented));
                }
            }, true);
        });
        const views = [];
        page.on('request', (r) => {
            if (r.isNavigationRequest() && new URL(r.url()).pathname.startsWith('/page/view/')) views.push(r.url());
        });

        // The box of the first line of the snippet text itself (the <p> is wider than it).
        const line = await summary.evaluate((p) => {
            const range = document.createRange();
            range.selectNodeContents(p);
            const { left, right, top, bottom } = range.getClientRects()[0];
            return { left, right, top, bottom };
        });
        const y = (line.top + line.bottom) / 2;
        await page.mouse.move(line.left + 2, y);
        await page.mouse.down();
        await page.mouse.move((line.left + line.right) / 2, y, { steps: 5 });
        await page.mouse.move(line.right - 2, y, { steps: 5 });
        // Hold longer than the 300 ms threshold, as a user selecting text does.
        await page.waitForTimeout(400);
        await page.mouse.up();

        // The click that ends the drag is cancelled, so the link is not followed.
        await expect.poll(() => page.evaluate(() => window.overlayClicks)).toEqual([true]);
        expect(views).toEqual([]);

        const selected = await page.evaluate(() => window.getSelection().toString());
        expect(selected.trim().length).toBeGreaterThan(5);
        expect((await summary.textContent()).replace(/\s+/g, ' ')).toContain(selected.replace(/\s+/g, ' ').trim());
        // The overlay is clickable again once the drag ends.
        await expect(pageSearchPage.result(0).locator('.overlay-link')).toHaveCSS('pointer-events', 'auto');
    });

    test('a short click on a result follows its link', async ({ page, pageSearchPage }) => {
        await pageSearchPage.goto('fccn');
        const overlay = pageSearchPage.result(0).locator('.overlay-link');
        await expect(overlay).toBeAttached();
        const href = await overlay.getAttribute('href');

        // /page/view/... records the view and redirects to the replay. A short timeout, so
        // a click that is wrongly cancelled fails fast instead of at the test timeout.
        const [request] = await Promise.all([
            page.waitForRequest(
                (r) => r.isNavigationRequest() && new URL(r.url()).pathname.startsWith('/page/view/'),
                { timeout: 5000 },
            ),
            overlay.click(),
        ]);

        expect(new URL(request.url()).pathname).toBe(href);
    });
});
