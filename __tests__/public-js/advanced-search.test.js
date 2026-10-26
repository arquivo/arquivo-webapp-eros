/** @jest-environment jsdom */

'use strict';

const { describeScript } = require('./helpers/load-script.cjs');

// Trimmed copy of the form in views/templates/body/body-pages-advanced-search.ejs.
const FORM = `
<form id="advanced-search-form-pages" class="advanced-search-form" action="/page/search" method="GET">
<fieldset>
  <input id="words" type="text" name="adv_and" value="">
  <label for="type">Format</label>
  <input type="hidden" name="type">
  <table id="table-format">
    <tbody>
      <tr>
        <td><input type="checkbox" id="format-all" format="all"></td>
        <td><label for="format-all"><strong>All formats</strong></label></td>
        <td><input type="checkbox" id="format-xls" format="xls"></td>
        <td><label for="format-xls">Microsoft Excel (.xls)</label></td>
      </tr>
      <tr>
        <td><input type="checkbox" id="format-ppt" format="ppt"></td>
        <td><label for="format-ppt">Microsoft PowerPoint (.ppt)</label></td>
        <td><input type="checkbox" id="format-pdf" format="pdf"></td>
        <td><label for="format-pdf">Adobe PDF (.pdf)</label></td>
      </tr>
    </tbody>
  </table>
  <input id="website" type="text" name="siteSearch" value="">
  <button type="submit" class="search-form-advanced-button">Search</button>
</fieldset>
</form>`;

const $id = (id) => document.getElementById(id);
const typeInput = () => document.querySelector('input[name=type]');
const others = () => ['format-xls', 'format-ppt', 'format-pdf'].map($id);

// Fire a submit event the way the browser does before it navigates.
function submit(form = document.querySelector('form')) {
    const event = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(event);
    return event;
}

describeScript('js/advanced-search.js', { html: FORM }, ({ setup, whileParsing }) => {
    describe('on submit', () => {
        it('writes the checked formats, in page order, to the hidden type input', () => {
            setup();
            $id('format-pdf').checked = true;
            $id('format-xls').checked = true;

            const event = submit();

            expect(typeInput().value).toBe('xls,pdf');
            expect(event.defaultPrevented).toBe(false);
        });

        it('writes "all" when the all formats box is checked', () => {
            setup();
            $id('format-all').checked = true;
            $id('format-ppt').checked = true;

            submit();

            expect(typeInput().value).toBe('all');
        });

        it('writes an empty type when no format is checked', () => {
            setup();
            typeInput().value = 'stale';

            submit();

            expect(typeInput().value).toBe('');
        });

        it('removes all whitespace from the website field', () => {
            setup();
            $id('website').value = ' arquivo.pt /wayback\tsite \n';

            submit();

            expect($id('website').value).toBe('arquivo.pt/waybacksite');
        });

        it('leaves an empty website field empty', () => {
            setup();

            submit();

            expect($id('website').value).toBe('');
        });

        it('does not throw when the form has no type or website inputs', () => {
            setup(`<form class="advanced-search-form" action="/page/search">
                <input type="checkbox" format="xls" checked></form>`);

            expect(() => submit()).not.toThrow();
        });

        it('ignores forms that are not the advanced search form', () => {
            setup(`${FORM}<form id="other" action="/page/search"><input type="hidden" name="type" value="x"></form>`);

            submit($id('other'));

            expect($id('other').querySelector('input[name=type]').value).toBe('x');
            expect(typeInput().value).toBe('');
        });
    });

    describe('format checkboxes', () => {
        it('checking "all" checks every other format', () => {
            setup();
            $id('format-ppt').checked = true;

            $id('format-all').click();

            expect(others().map((x) => x.checked)).toEqual([true, true, true]);
        });

        it('unchecking "all" unchecks every other format', () => {
            setup();
            $id('format-all').click();

            $id('format-all').click();

            expect($id('format-all').checked).toBe(false);
            expect(others().map((x) => x.checked)).toEqual([false, false, false]);
        });

        it('unchecking any format unchecks "all"', () => {
            setup();
            $id('format-all').click();

            $id('format-ppt').click();

            expect($id('format-all').checked).toBe(false);
            expect(others().map((x) => x.checked)).toEqual([true, false, true]);
        });

        it('checking the last unchecked format checks "all"', () => {
            setup();
            $id('format-xls').click();
            $id('format-ppt').click();
            expect($id('format-all').checked).toBe(false);

            $id('format-pdf').click();

            expect($id('format-all').checked).toBe(true);
        });

        it('checking one format while others stay unchecked leaves "all" unchecked', () => {
            setup();

            $id('format-xls').click();

            expect($id('format-all').checked).toBe(false);
            expect(others().map((x) => x.checked)).toEqual([true, false, false]);
        });
    });

    it('does nothing on pages without the advanced search form', () => {
        expect(() => setup('<form id="x"><input type="checkbox" format="all"></form>')).not.toThrow();
    });

    it('waits for DOMContentLoaded when loaded from <head>', async () => {
        const fireDOMContentLoaded = await whileParsing();
        setup();
        $id('format-xls').checked = true;

        submit();
        expect(typeInput().value).toBe('');

        fireDOMContentLoaded();
        submit();
        expect(typeInput().value).toBe('xls');
    });
});
