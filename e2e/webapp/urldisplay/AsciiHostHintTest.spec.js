'use strict';

const { test, expect } = require('../../fixtures');
const { IDN_QUERY, IDN_URL } = require('../../mock-server/fixtures');

// An address with a non-ASCII host gets its ASCII (punycode) host shown in a
// `.url-ascii-host` element. The addresses themselves are cut off with an
// ellipsis when they don't fit, so this checks, at a phone and a desktop
// width, that the ASCII host of the mock's long IDN_URL is fully visible: not
// clipped by any ancestor that hides overflow, nor overflowing itself or the
// result card (or details row) it belongs to.
const ASCII_HOST = new URL(IDN_URL).hostname;
const CARD = '.page-search-result, .image-card, .technical-details-row';
const VIEWPORTS = [
    { width: 375, height: 812 },
    { width: 1280, height: 800 },
];

async function clippingOf(hint) {
    return hint.evaluate((el, cardSelector) => {
        el.scrollIntoView({ block: 'center' });
        const box = el.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) return 'not rendered';
        if (el.scrollWidth > el.clientWidth + 1) return 'overflows itself';
        if (box.left < 0 || box.right > document.documentElement.clientWidth + 1) return 'outside the viewport';
        const card = el.closest(cardSelector);
        if (!card) return 'not inside a card';
        const cardBox = card.getBoundingClientRect();
        if (box.left < cardBox.left - 1 || box.right > cardBox.right + 1
            || box.top < cardBox.top - 1 || box.bottom > cardBox.bottom + 1) {
            return `outside its card ${card.tagName.toLowerCase()}.${card.className}`;
        }
        for (let parent = el.parentElement; parent; parent = parent.parentElement) {
            const style = getComputedStyle(parent);
            if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
            const clip = parent.getBoundingClientRect();
            if (box.left < clip.left - 1 || box.right > clip.right + 1
                || box.top < clip.top - 1 || box.bottom > clip.bottom + 1) {
                return `clipped by ${parent.tagName.toLowerCase()}.${parent.className}`;
            }
        }
        return null;
    }, CARD);
}

async function expectHintVisible(hint) {
    await expect(hint).toBeVisible();
    await expect(hint).toHaveText(`(${ASCII_HOST})`);
    expect(await clippingOf(hint)).toBeNull();
}

for (const viewport of VIEWPORTS) {
    test.describe(`at ${viewport.width}px`, () => {
        test.use({ viewport });

        test('page search results show the whole ASCII host of an IDN address', async ({ pageSearchPage }) => {
            await pageSearchPage.goto(IDN_QUERY);

            await expectHintVisible(pageSearchPage.results.first().locator('.url-ascii-host'));
        });

        test('image search results show the whole ASCII host of an IDN page address', async ({ imageSearchPage }) => {
            await imageSearchPage.goto(IDN_QUERY);

            await expectHintVisible(imageSearchPage.result(0).locator('.url-ascii-host'));
        });

        test('replay technical details show the whole ASCII host of an IDN address', async ({ page, replayOptionsMenu, technicalDetailsModal }) => {
            await page.goto(`/wayback/20180101100000/http://${IDN_QUERY}.pt/`);
            await replayOptionsMenu.open();
            await replayOptionsMenu.technicalDetailsLink.click();
            await expect(technicalDetailsModal.modal).toBeVisible();

            await expectHintVisible(technicalDetailsModal.row('originalURL').locator('.url-ascii-host'));
        });
    });
}
