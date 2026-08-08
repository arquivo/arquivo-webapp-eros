/**
 * Left navigation menu — shared between homepage and replay pages (same
 * button id/partial: views/templates/menu/menu-button.ejs +
 * left_nav_menu.ejs / left_nav_replay_menu.ejs both target #left-nav /
 * #replay-left-nav via #nav-menu-button-left).
 */
class MenuPage {
    constructor(page) {
        this.page = page;
        this.openButton = page.locator('#nav-menu-button-left');
        this.leftNav = page.locator('#left-nav, #replay-left-nav');
    }

    async open() {
        await this.openButton.click();
    }
}

module.exports = { MenuPage };
