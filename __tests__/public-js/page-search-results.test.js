/** @jest-environment jsdom */
const { describeScript } = require('./helpers/load-script.cjs');

// One result card, trimmed from views/templates/fragments/page-result.ejs. The overlay
// link is empty in the real card; `overlay` lets a test put content inside it.
const result = (index, { summary = 'hello world', overlay = '' } = {}) => `
<ul class="page-search-result" data-index="${index}">
  <li><a href="/page/view/x_${index}/20200101000000/http%3A%2F%2Fexample.com%2F" class="overlay-link" id="overlay-${index}">${overlay}</a></li>
  <li><a class="results-title blockUrl" id="title-${index}">Title ${index}</a></li>
  <li><p class="results-summary blockUrl" id="summary-${index}">${summary}</p></li>
</ul>`;

// views/templates/body/body-pages-search-results.ejs after init.js loaded the results.
const RESULTS = `
<section id="pages-results" class="pages-results-cl">
  ${result(1)}
  ${result(2, { summary: 'second card', overlay: '<span id="nested"><b id="deep">x</b></span>' })}
</section>`;

// The same section before init.js replaced the loading section with the results.
const LOADING = `
<section id="pages-results" class="pages-results-cl">
  <section id="loading-section"><form id="loading-form"></form></section>
</section>`;

const $id = (id) => document.getElementById(id);
const data = () => window.page_search_result_data;
const textOf = (id) => $id(id).firstChild;

const T0 = new Date(2024, 0, 2, 3, 4, 5).getTime();

// --- Layout stubs: jsdom has no layout, elementFromPoint or Range#getBoundingClientRect.
//
// Each laid-out text node gets a row; its characters are 10px wide and the row is 10px
// tall, so the character at offset i covers x in (10i, 10i + 10). A laid-out element
// covers its own text, starting at x = 0 on its row.
let rows;
let hit;
let fromPointCalls;
let watched;

function layout(node, row) {
    rows.set(node, row);
}

// The point in the middle of character `offset` of a laid-out text node.
function pointAt(textNode, offset) {
    return { clientX: offset * 10 + 5, clientY: rows.get(textNode) * 20 + 5 };
}

function rangeRect() {
    const ZERO = { left: 0, right: 0, top: 0, bottom: 0 };
    let node;
    let left;
    let right;
    if (this.startContainer.nodeType === Node.TEXT_NODE) {
        // One character, from Range#setStart/setEnd in checkNode.
        node = this.startContainer;
        left = this.startOffset * 10;
        right = this.endOffset * 10;
    } else {
        // A whole node, from Range#selectNode in checkNodePosition.
        node = this.startContainer.childNodes[this.startOffset];
        left = 0;
        right = (node.nodeType === Node.TEXT_NODE ? node.length : node.textContent.length) * 10;
    }
    if (!rows.has(node)) return ZERO;
    const top = rows.get(node) * 20;
    return { left, right, top, bottom: top + 10 };
}

// --- Events.
function mouse(type, target, init = {}) {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init });
    target.dispatchEvent(event);
    return event;
}

describeScript('js/page-search-results.js', { html: RESULTS }, ({ setup, whileParsing }) => {
    let originalBody;

    beforeEach(() => {
        // A fresh <body> per test, so the mousemove listeners that earlier tests (and
        // earlier jQuery copies) bound on it don't run again.
        originalBody = document.body;
        document.documentElement.replaceChild(document.createElement('body'), originalBody);

        rows = new Map();
        hit = null;
        watched = null;
        fromPointCalls = [];
        document.elementFromPoint = jest.fn((x, y) => {
            fromPointCalls.push({ x, y, pointerEvents: watched && watched.style.pointerEvents });
            return hit || document.body;
        });
        Range.prototype.getBoundingClientRect = rangeRect;
        window.getSelection().removeAllRanges();
        jest.useFakeTimers({ now: T0 });
    });

    afterEach(() => {
        jest.useRealTimers();
        delete document.elementFromPoint;
        delete Range.prototype.getBoundingClientRect;
        document.documentElement.replaceChild(originalBody, document.body);
    });

    // Press the left button on `target` at character `offset` of `textNode`.
    // elementFromPoint returns the parent of `textNode`, as if the overlay were not there.
    function pressOn(target, textNode, offset) {
        hit = textNode.parentNode;
        return mouse('mousedown', target, pointAt(textNode, offset));
    }

    // The same for a mouse move.
    function moveOver(target, textNode, offset) {
        hit = textNode.parentNode;
        return mouse('mousemove', target, pointAt(textNode, offset));
    }

    describe('mousedown on a result overlay link', () => {
        it('starts a text selection at the point under the overlay', () => {
            setup();
            const text = textOf('summary-1');
            layout(text, 0);
            watched = $id('overlay-1');

            const event = pressOn($id('overlay-1'), text, 2);

            expect(event.defaultPrevented).toBe(true);
            expect(data().selecting).toBe(true);
            expect(data().lastMouseDown.getTime()).toBe(T0);
            expect(data().start).toEqual([text, 2]);
            // The overlay lets the point through only while elementFromPoint looks.
            expect(fromPointCalls).toEqual([{ x: 25, y: 5, pointerEvents: 'none' }]);
            expect($id('overlay-1').style.pointerEvents).toBe('auto');
            // The (still empty) selection range is now the document selection.
            const selection = window.getSelection();
            expect(selection.rangeCount).toBe(1);
            expect(selection.getRangeAt(0)).toBe(data().range);
        });

        it('falls back to the element itself when no child is under the point', () => {
            setup();
            hit = $id('title-1');

            mouse('mousedown', $id('overlay-1'), { clientX: 500, clientY: 500 });

            expect(data().start).toEqual([$id('title-1'), 0]);
        });

        it('finds the point inside a child element of the element under the point', () => {
            // elementFromPoint can return the <p> while the point is in one of its child
            // elements, e.g. the <em> highlight of a search term. checkNode used to read an
            // undeclared `nodes` there and throw, which left the overlay at pointer-events:
            // none, so the card stopped opening on click until a reload.
            setup(RESULTS.replace('second card', 'second <em id="term">card</em> text'));
            const before = textOf('summary-2');
            const term = textOf('term');
            layout(before, 0);
            layout($id('term'), 1);
            layout(term, 1);
            watched = $id('overlay-2');

            hit = $id('summary-2');
            const event = mouse('mousedown', $id('overlay-2'), pointAt(term, 2));

            expect(event.defaultPrevented).toBe(true);
            expect(data().start).toEqual([term, 2]);
            expect($id('overlay-2').style.pointerEvents).toBe('auto');
        });

        it('also runs for a press on an element nested inside the overlay link', () => {
            setup();
            const text = textOf('summary-2');
            layout(text, 1);
            watched = $id('deep');

            const event = pressOn($id('deep'), text, 4);

            expect(event.defaultPrevented).toBe(true);
            expect(data().selecting).toBe(true);
            expect(data().start).toEqual([text, 4]);
            // As with jQuery, it is the event target that lets the point through, not the link.
            expect(fromPointCalls).toEqual([{ x: 45, y: 25, pointerEvents: 'none' }]);
            expect($id('deep').style.pointerEvents).toBe('auto');
            expect($id('overlay-2').style.pointerEvents).toBe('');
        });

        it('treats a press on a text node in the overlay link as a press on the link', () => {
            setup(`<section id="pages-results"><a class="overlay-link" id="overlay-t" href="#">text</a><p id="p">abc</p></section>`);
            const text = textOf('p');
            layout(text, 0);
            watched = $id('overlay-t');

            const event = pressOn(textOf('overlay-t'), text, 1);

            expect(event.defaultPrevented).toBe(true);
            expect(fromPointCalls).toEqual([{ x: 15, y: 5, pointerEvents: 'none' }]);
            expect($id('overlay-t').style.pointerEvents).toBe('auto');
        });

        it.each([
            ['middle', 1],
            ['right', 2],
        ])('ignores the %s button', (_name, button) => {
            setup();

            const event = mouse('mousedown', $id('overlay-1'), { button });

            expect(event.defaultPrevented).toBe(false);
            expect(data().selecting).toBe(false);
            expect(document.elementFromPoint).not.toHaveBeenCalled();
            expect(window.getSelection().rangeCount).toBe(0);
        });
    });

    describe('mousedown elsewhere', () => {
        it('ignores a press on a result element that is not the overlay link', () => {
            setup();

            const event = mouse('mousedown', $id('title-1'));

            expect(event.defaultPrevented).toBe(false);
            expect(data().selecting).toBe(false);
            expect(document.elementFromPoint).not.toHaveBeenCalled();
        });

        it('ignores a press on the results section itself', () => {
            setup();

            const event = mouse('mousedown', $id('pages-results'));

            expect(event.defaultPrevented).toBe(false);
            expect(data().selecting).toBe(false);
        });

        it('ignores an overlay link outside #pages-results', () => {
            setup(RESULTS + '<a href="/services/archivepagenow" class="overlay-link" id="outside"></a>');

            const event = mouse('mousedown', $id('outside'));

            expect(event.defaultPrevented).toBe(false);
            expect(data().selecting).toBe(false);
        });

        it('ignores an overlay link that wraps #pages-results', () => {
            // jQuery only matches from the target up to the element it is bound on.
            setup('<a class="overlay-link" id="wrapper" href="#"><section id="pages-results"><p id="p">abc</p></section></a>');

            const event = mouse('mousedown', $id('p'));

            expect(event.defaultPrevented).toBe(false);
            expect(data().selecting).toBe(false);
            expect(document.elementFromPoint).not.toHaveBeenCalled();
        });

        it('does nothing when the page has no #pages-results', () => {
            setup('<a href="/services/archivepagenow" class="overlay-link" id="outside"></a>');

            const event = mouse('mousedown', $id('outside'));

            expect(event.defaultPrevented).toBe(false);
            expect(data().selecting).toBe(false);
        });
    });

    describe('results added after the script ran', () => {
        it('handles the results that replace the loading section', () => {
            setup(LOADING);
            // What init.js does with the /partials/pages-search-results response.
            $id('loading-section').outerHTML = result(7);
            const text = textOf('summary-7');
            layout(text, 0);

            const down = pressOn($id('overlay-7'), text, 1);
            moveOver($id('overlay-7'), text, 4);

            expect(down.defaultPrevented).toBe(true);
            expect(data().range.toString()).toBe('ell');

            jest.setSystemTime(T0 + 301);
            mouse('mouseup', $id('overlay-7'));
            expect(mouse('click', $id('overlay-7')).defaultPrevented).toBe(true);
        });

        it('handles a result appended next to the existing ones', () => {
            setup();
            $id('pages-results').insertAdjacentHTML('beforeend', result(8, { overlay: '<i id="icon"></i>' }));

            const event = mouse('mousedown', $id('icon'));

            expect(event.defaultPrevented).toBe(true);
            expect(data().selecting).toBe(true);
        });
    });

    describe('mousemove while selecting', () => {
        it('extends the selection to the point under the overlay link', () => {
            setup();
            const text = textOf('summary-1');
            layout(text, 0);
            pressOn($id('overlay-1'), text, 2);
            watched = $id('overlay-1');
            fromPointCalls = [];

            moveOver($id('overlay-1'), text, 7);

            expect(data().end).toEqual([text, 7]);
            expect(fromPointCalls).toEqual([{ x: 75, y: 5, pointerEvents: 'none' }]);
            expect($id('overlay-1').style.pointerEvents).toBe('auto');
            expect(data().range.toString()).toBe('llo w');
            expect(window.getSelection().getRangeAt(0)).toBe(data().range);
        });

        it('orders the range when dragging backwards in the same text', () => {
            setup();
            const text = textOf('summary-1');
            layout(text, 0);
            pressOn($id('overlay-1'), text, 7);

            moveOver($id('overlay-1'), text, 2);

            expect(data().start).toEqual([text, 7]);
            expect(data().end).toEqual([text, 2]);
            expect(data().range.toString()).toBe('llo w');
        });

        it('orders the range when dragging backwards across results', () => {
            setup();
            const first = textOf('summary-1');
            const second = textOf('summary-2');
            layout(first, 0);
            layout(second, 1);
            pressOn($id('overlay-2'), second, 3);

            moveOver($id('overlay-1'), first, 6);

            expect(data().range.startContainer).toBe(first);
            expect(data().range.startOffset).toBe(6);
            expect(data().range.endContainer).toBe(second);
            expect(data().range.endOffset).toBe(3);
            expect(data().range.toString()).toContain('world');
            expect(data().range.toString()).toContain('sec');
        });

        it('leaves the style of a target that is not an overlay link alone', () => {
            setup();
            const text = textOf('summary-1');
            layout(text, 0);
            pressOn($id('overlay-1'), text, 0);
            watched = $id('summary-1');
            fromPointCalls = [];

            moveOver($id('summary-1'), text, 3);

            expect(fromPointCalls).toEqual([{ x: 35, y: 5, pointerEvents: '' }]);
            expect($id('summary-1').style.pointerEvents).toBe('');
            expect(data().range.toString()).toBe('hel');
        });

        it('treats a move over a text node like a move over its parent', () => {
            setup();
            const text = textOf('summary-1');
            layout(text, 0);
            pressOn($id('overlay-1'), text, 0);

            moveOver(text, text, 2);

            expect($id('summary-1').style.pointerEvents).toBe('');
            expect(data().range.toString()).toBe('he');
        });

        it('extends the selection outside the results too (bound on body)', () => {
            setup(RESULTS + '<footer id="footer">foot</footer>');
            const text = textOf('summary-1');
            const foot = textOf('footer');
            layout(text, 0);
            layout(foot, 3);
            pressOn($id('overlay-1'), text, 6);

            moveOver($id('footer'), foot, 2);

            expect(data().end).toEqual([foot, 2]);
            expect(data().range.startContainer).toBe(text);
            expect(data().range.endContainer).toBe(foot);
        });

        it('does nothing before a press', () => {
            setup();
            const text = textOf('summary-1');
            layout(text, 0);

            moveOver($id('overlay-1'), text, 3);

            expect(document.elementFromPoint).not.toHaveBeenCalled();
            expect(data().end).toBeNull();
            expect($id('overlay-1').style.pointerEvents).toBe('');
        });

        it('stops once the button is released anywhere', () => {
            setup(RESULTS + '<footer id="footer">foot</footer>');
            const text = textOf('summary-1');
            layout(text, 0);
            pressOn($id('overlay-1'), text, 1);
            moveOver($id('overlay-1'), text, 3);

            mouse('mouseup', $id('footer'));
            expect(data().selecting).toBe(false);
            document.elementFromPoint.mockClear();
            moveOver($id('overlay-1'), text, 8);

            expect(document.elementFromPoint).not.toHaveBeenCalled();
            expect(data().range.toString()).toBe('el');
        });
    });

    describe('click on a result overlay link', () => {
        // Records whether the click reached the document and if it was cancelled by then,
        // and then cancels it, as jsdom can't follow links.
        let documentClicks;
        // For each click that reached the document: was it cancelled by then?
        const reachedDocument = () => documentClicks.mock.results.map((r) => r.value);

        beforeEach(() => {
            documentClicks = jest.fn((e) => {
                const cancelled = e.defaultPrevented;
                e.preventDefault();
                return cancelled;
            });
            document.addEventListener('click', documentClicks);
        });

        afterEach(() => {
            document.removeEventListener('click', documentClicks);
        });

        it('follows the link after a short press', () => {
            setup();
            mouse('mousedown', $id('overlay-1'));
            jest.setSystemTime(T0 + 300);

            mouse('click', $id('overlay-1'));

            expect(reachedDocument()).toEqual([false]);
        });

        it('cancels the link and stops the click after a long press (text selection)', () => {
            setup();
            mouse('mousedown', $id('overlay-1'));
            jest.setSystemTime(T0 + 301);

            const event = mouse('click', $id('overlay-1'));

            expect(event.defaultPrevented).toBe(true);
            expect(documentClicks).not.toHaveBeenCalled();
        });

        it('cancels a click on an element nested inside the overlay link too', () => {
            setup();
            mouse('mousedown', $id('deep'));
            jest.setSystemTime(T0 + 1000);

            const event = mouse('click', $id('deep'));

            expect(event.defaultPrevented).toBe(true);
            expect(documentClicks).not.toHaveBeenCalled();
        });

        it('cancels a click that had no press on the page', () => {
            // lastMouseDown starts at 0, so any click counts as a long press.
            setup();

            const event = mouse('click', $id('overlay-1'));

            expect(event.defaultPrevented).toBe(true);
            expect(documentClicks).not.toHaveBeenCalled();
        });

        it('leaves a click with a non-main button alone, as jQuery delegation does', () => {
            setup();

            mouse('click', $id('overlay-1'), { button: 1 });

            expect(reachedDocument()).toEqual([false]);
        });

        it('leaves clicks outside the overlay links alone', () => {
            setup(RESULTS + '<a href="/services/archivepagenow" class="overlay-link" id="outside"></a>');

            mouse('click', $id('title-1'));
            mouse('click', $id('outside'));

            expect(reachedDocument()).toEqual([false, false]);
        });
    });

    describe('timing', () => {
        it('creates page_search_result_data at once but binds once the DOM is parsed', async () => {
            const fireDOMContentLoaded = await whileParsing();
            setup();

            expect(data()).toEqual({});
            const early = mouse('mousedown', $id('overlay-1'));
            expect(early.defaultPrevented).toBe(false);
            expect(data().selecting).toBeUndefined();

            fireDOMContentLoaded();

            expect(data()).toMatchObject({ lastMouseDown: 0, threshold: 300, selecting: false, start: null, end: null });
            expect(mouse('mousedown', $id('overlay-1')).defaultPrevented).toBe(true);
            expect(data().selecting).toBe(true);
        });

        it('keeps its helper functions out of the global scope', () => {
            setup();

            expect(window.getElementAndOffsetFromPoint).toBeUndefined();
            expect(window.checkNode).toBeUndefined();
            expect(window.checkNodePosition).toBeUndefined();
            expect(window.updateSelection).toBeUndefined();
        });
    });
});
