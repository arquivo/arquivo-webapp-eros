/**
 * Replay page's right-hand options menu + toolbar modals.
 * Selectors from views/templates/menu/options-button.ejs,
 * views/templates/menu/replay_right_nav_menu.ejs,
 * views/templates/header/header-replay.ejs.
 *
 * Note: the actual archived-page iframe (pywb embedding) is commented out in
 * views/templates/body/body-replay.ejs pending a pywb-side change — only
 * that piece is out of scope. This toolbar chrome is fully testable.
 */
class ReplayOptionsMenu {
    constructor(page) {
        this.page = page;
        this.openButton = page.locator('#nav-options-right-button');
        this.closeButton = page.locator('#right-nav-close-button');
        this.nav = page.locator('#replay-right-nav');

        this.listVersionsLink = page.locator('#menuListVersions');
        this.technicalDetailsLink = page.locator('#menuTechnicalDetails');
        this.screenshotLink = page.locator('#menuScreenshot');
        this.printLink = page.locator('#menuPrint');
        this.completeThePageLink = page.locator('#menuCompleteThePage');
        this.fullScreenLink = page.locator('#menuFullScreen');
        this.replayWithOldBrowserLink = page.locator('#menuReplayWithOldBrowser');

        this.screenshotModal = page.locator('#screenshot.modal');
        this.printModal = page.locator('#print.modal');
        this.completeThePageModal = page.locator('#complete-the-page.modal');
        this.replayWithOldBrowserModal = page.locator('#replay-with-old-browser.modal');
    }

    async open() {
        await this.openButton.click();
    }

    async close() {
        await this.closeButton.click();
    }
}

module.exports = { ReplayOptionsMenu };
