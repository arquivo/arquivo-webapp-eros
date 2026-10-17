/** @jest-environment jsdom */

'use strict';

const { describeScript, loadScript } = require('./helpers/load-script.cjs');

// The export links from views/templates/menu/options_right_nav_menu.ejs.
const MENU = `
<nav id="options-right-nav"><section><ul>
  <li><a href="#" id="options-export-xlsx">Export XLSX</a></li>
  <li><a href="#" id="options-export-csv">Export CSV</a></li>
  <li><a href="#" id="options-export-ods">Export ODS</a></li>
  <li><a href="#" id="options-export-txt">Export TXT</a></li>
</ul></section></nav>`;

const ROWS = [
    ['Title', 'URL', 'Date'],
    ['Arquivo.pt & "amigos"', 'https://arquivo.pt/?a=1,2', '2020-01-02'],
    ["Ação, <b>não</b> d'água", 'http://example.com/', '1999'],
];

// The hidden JSON block from views/partials/pages-search-results.ejs, escaped as there.
const escaped = JSON.stringify(ROWS)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
const EXPORT_JSON = `<div style="display:none" id="options-export-json">${escaped}</div>`;

const EXTENSIONS = ['xlsx', 'csv', 'ods', 'txt'];

// Local time; jest.global-setup.js runs the suite in UTC+14.
const NOW = new Date(2024, 0, 2, 3, 4, 5);

function click(id) {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.getElementById(id).dispatchEvent(event);
    return event;
}

describeScript('js/exports.js', { html: MENU + EXPORT_JSON }, ({ setup, whileParsing }) => {
    let writeFile;

    beforeAll(() => {
        // The real export library the page loads.
        loadScript('vendor/js/xlsx.full.min.js');
    });

    beforeEach(() => {
        delete window.dataLayer;
        writeFile = jest.spyOn(window.XLSX, 'writeFile').mockImplementation(() => {});
        jest.useFakeTimers({ now: NOW });
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it.each(EXTENSIONS)('the %s link writes the results to a timestamped file', (ext) => {
        setup();

        const event = click('options-export-' + ext);

        expect(event.defaultPrevented).toBe(true);
        expect(writeFile).toHaveBeenCalledTimes(1);
        const [workbook, filename] = writeFile.mock.calls[0];
        expect(filename).toBe(`arquivo_pt_page_search_20240102030405.${ext}`);
        expect(workbook.Props).toEqual({
            Title: 'Arquivo.pt search page_search export',
            Subject: 'Arquivo.pt search page_search export',
            Author: 'Arquivo.pt',
            CreatedDate: NOW,
        });
        expect(workbook.SheetNames).toEqual(['page_search export']);
        expect(window.XLSX.utils.sheet_to_json(workbook.Sheets['page_search export'], { header: 1 })).toEqual(ROWS);
    });

    it('produces the same CSV bytes for the export', () => {
        setup();

        click('options-export-csv');

        const [workbook] = writeFile.mock.calls[0];
        expect(window.XLSX.write(workbook, { bookType: 'csv', type: 'string' })).toBe(
            'Title,URL,Date\n' +
            '"Arquivo.pt & ""amigos""","https://arquivo.pt/?a=1,2",2020-01-02\n' +
            '"Ação, <b>não</b> d\'água",http://example.com/,1999'
        );
    });

    it('reports the export to the tag manager data layer', () => {
        setup();
        window.dataLayer = [{ event: 'earlier' }];

        click('options-export-ods');

        expect(window.dataLayer).toEqual([
            { event: 'earlier' },
            { event: 'export_serp', event_category: 'page_search', event_label: 'ods' },
        ]);
    });

    it('creates the data layer when the page has none', () => {
        setup();

        click('options-export-txt');

        expect(window.dataLayer).toEqual([{ event: 'export_serp', event_category: 'page_search', event_label: 'txt' }]);
    });

    it('only cancels the click when the page has no results to export', () => {
        setup(MENU);

        const event = click('options-export-xlsx');

        expect(event.defaultPrevented).toBe(true);
        expect(writeFile).not.toHaveBeenCalled();
        expect(window.dataLayer).toBeUndefined();
    });

    it('looks for the results when the link is clicked, not when the page loads', () => {
        setup(MENU);
        document.body.insertAdjacentHTML('beforeend', EXPORT_JSON);

        click('options-export-csv');

        expect(writeFile).toHaveBeenCalledTimes(1);
    });

    it('binds the links that exist when some are missing', () => {
        setup('<a href="#" id="options-export-csv">CSV</a>' + EXPORT_JSON);

        click('options-export-csv');

        expect(writeFile).toHaveBeenCalledTimes(1);
    });

    it('does nothing on pages without the export menu', () => {
        expect(() => setup(EXPORT_JSON)).not.toThrow();
    });

    it('waits for DOMContentLoaded when loaded from <head>', async () => {
        jest.useRealTimers();
        const fireDOMContentLoaded = await whileParsing();
        setup();

        expect(click('options-export-xlsx').defaultPrevented).toBe(false);
        expect(writeFile).not.toHaveBeenCalled();

        fireDOMContentLoaded();

        expect(click('options-export-xlsx').defaultPrevented).toBe(true);
        expect(writeFile).toHaveBeenCalledTimes(1);
    });
});
