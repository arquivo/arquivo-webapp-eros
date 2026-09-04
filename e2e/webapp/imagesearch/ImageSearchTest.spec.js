const { test, expect } = require('../../fixtures');
const { TOTAL_IMAGE_RESULTS } = require('../../mock-server/fixtures');

/**
 * Ported from docs/webapp/imagesearch/ImageSearchTest.md.
 *
 * The doc's own numeric/text assertions (image alt "PUBLICO", the
 * shiva.di.uminho.pt 1996 capture, its exact dates and technical-details
 * strings) are tied to fixed historical crawl content and are preserved
 * as `@live`. The image-viewer modal *mechanics* (open on click, metadata
 * fields populated from the item's own data, Details panel, copy/close
 * buttons) are exercised against the mock corpus below, since
 * views/templates/fragments/image-result.ejs + public/js/modal-image-result.js
 * still use the same ids/classes the original doc references
 * (#image-card-1, #modal, #image-details-button, #copy-raw-api-data,
 * #close-modal-tecnhical) — these were not stale.
 */
test('opens the image viewer modal and shows metadata + technical details for the first result', async ({ page, imageSearchPage }) => {
    await imageSearchPage.goto('Publico collection:Roteiro', { locale: 'pt' });

    await expect(imageSearchPage.estimatedResults).toContainText(String(TOTAL_IMAGE_RESULTS));
    await expect(imageSearchPage.results.first()).toBeVisible();

    // "First image details should be shown after clicking on it"
    await imageSearchPage.openResult(0);
    await expect.soft(imageSearchPage.modal).toBeVisible();

    // "Check image alt/original link/page title/page URL in image viewer"
    await expect.soft(page.locator('.image-alt')).toHaveText('Mock image 1');
    await expect.soft(page.locator('.image-original-address')).toHaveText('http://example.com/mock-image-1.jpg');
    await expect.soft(page.locator('.page-title')).toHaveText('Mock result 1 for Publico collection:Roteiro');
    await expect.soft(page.locator('.page-original-address')).toHaveText('http://example.com/mock-page-1');

    // "Click on Details button"
    await page.locator('#image-details-button').click();
    const technicalDetails = page.locator('#modal-window-image-technical-details');
    await expect.soft(technicalDetails).toBeVisible();

    // "Check image detail page contains page timestamp/link to archive" (mock equivalents)
    const rawApiData = page.locator('p.raw-api-data');
    await expect.soft(rawApiData).toContainText('20180101100000');
    await expect.soft(rawApiData).toContainText('/wayback/20180101100000/http://example.com/mock-page-1');
    await expect.soft(rawApiData).toContainText('MOCKIMGDIGEST0');

    // "copy API details" / close technical-details panel — no explicit assertions, just that the clicks succeed
    await page.locator('#copy-raw-api-data').click();
    // #close-modal-tecnhical is a position:absolute <a> wrapping a
    // position:absolute <button> (public/css/modal-image-details.css's
    // generic `.modal button.close` rule) — the button is pulled out of the
    // anchor's flow, so the anchor's own box collapses to 0x0. Real users
    // still see/click the rendered button fine; the locator just needs to
    // target the button itself rather than the zero-size wrapping anchor.
    await page.locator('#close-modal-tecnhical button').click();
});

test('shows the real shiva.di.uminho.pt 1996 capture in the image viewer @live', async ({ page, imageSearchPage }) => {
    await imageSearchPage.goto('Publico collection:Roteiro', { locale: 'pt' });

    // "Verify if the estimated results count message is displayed on image search is greater than 2.200"
    // (doc's assertion message says "> 2.200" but the code actually checks >= 1.000 — preserved as-is)
    const estimateText = (await imageSearchPage.estimatedResults.textContent()) ?? '';
    const estimateValue = parseFloat(estimateText.trim().split(/\s+/)[2]?.replace(/\./g, '') ?? '0');
    expect(estimateValue).toBeGreaterThanOrEqual(1000);

    await imageSearchPage.openResult(0);
    await expect(imageSearchPage.modal).toBeVisible();

    await expect.soft(page.locator('.image-alt')).toHaveText('PUBLICO');
    await expect.soft(page.locator('.image-original-address')).toHaveText('http://shiva.di.uminho.pt:80/~pinj/0/6/20.gif');
    await expect.soft(page.locator('.image-description-date .date')).toHaveText('13 Outubro 15h00, 1996');
    await expect.soft(page.locator('.page-title')).toHaveText('Jose Miranda - HOME PAGE');
    await expect.soft(page.locator('.page-original-address')).toHaveText('http://shiva.di.uminho.pt:80/~pinj/');
    await expect.soft(page.locator('.page-description-date .date')).toHaveText('13 Outubro 14h59, 1996');

    await page.locator('#image-details-button').click();
    const rawApiData = page.locator('p.raw-api-data');
    await expect.soft(rawApiData).toContainText('19961013150044');
    await expect.soft(rawApiData).toContainText('PÚBLICO ON-LINE é um projecto experimental');
    await expect.soft(rawApiData).toContainText('arquivo.pt/wayback/19961013145930/http://shiva.di.uminho.pt:80/~pinj/');

    await page.locator('#copy-raw-api-data').click();
    // See the mocked test above for why the button (not the wrapping anchor) is targeted.
    await page.locator('#close-modal-tecnhical button').click();
});
