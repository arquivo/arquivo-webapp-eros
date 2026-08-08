/**
 * Technical-details modal (views/partials/replay-technical-details.ejs),
 * opened via ReplayOptionsMenu#technicalDetailsLink.
 */
class TechnicalDetailsModal {
    constructor(page) {
        this.page = page;
        this.modal = page.locator('#technical-details.modal');
        this.closeButton = this.modal.locator('.close.cancel');
        this.rows = this.modal.locator('.technical-details-row');
    }

    row(key) {
        return this.modal.locator(`.technical-details-row[data-key="${key}"]`);
    }

    async close() {
        await this.closeButton.click();
        if (await this.modal.isVisible()) {
            // The close button relies on a handler defined in
            // public/js/replay.js, whose <script> include is currently
            // HTML-commented-out in body-replay.ejs (since commit 6285390),
            // so the click above is presently a no-op. Escape reliably
            // closes the modal via jquery-modal's own core behavior, which
            // is independent of replay.js.
            await this.page.keyboard.press('Escape');
        }
    }
}

module.exports = { TechnicalDetailsModal };
