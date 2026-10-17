'use strict';

// HTML for the title and snippet of a page search result: the values from the search
// backend are shown as typed, with only the emphasis of the search terms as markup.

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&#34;', "'": '&#39;' };
const escapeChars = (text, chars) => text.replace(chars, (c) => ENTITIES[c]);

// The markup the backend adds to a snippet: the emphasis of the search terms, and the
// ellipsis between fragments. Matched exactly as sent, so any other markup is text.
const EM_OPEN = '<em>';
const EM_CLOSE = '</em>';
const ELLIPSIS = '<span class="ellipsis"> ... </span>';
// Must match exactly the EM_OPEN, EM_CLOSE and ELLIPSIS constants above.
const SNIPPET_MARKUP = /<em>|<\/em>|<span class="ellipsis"> \.\.\. <\/span>/g;

/**
 * Text as HTML: `&`, `<`, `>`, `"` and `'` escaped.
 *
 * @param {string} text - Text
 * @returns {string} HTML showing the text as typed
 */
const escapeHtml = (text) => escapeChars(String(text), /[&<>"']/g);

/**
 * Text as HTML, with the given ranges of the text in `<em>`.
 *
 * Each range is kept within the text and after the previous one, and an empty range is
 * skipped, so overlapping, reversed or out of bounds ranges never nest or empty the emphasis.
 *
 * @param {string} text - Text, e.g. a result title
 * @param {Array<[number, number]>} ranges - Ranges [start, end) of the text to emphasize
 * @returns {string} HTML showing the text as typed, with the ranges emphasized
 */
const emphasizedHtml = (text, ranges) => {
    let html = '';
    let position = 0;
    [...ranges].sort((a, b) => a[0] - b[0]).forEach((range) => {
        const start = Math.max(range[0], position);
        const end = Math.min(Math.max(range[1], start), text.length);
        if (end <= start) {
            return;
        }
        html += escapeHtml(text.substring(position, start)) + EM_OPEN + escapeHtml(text.substring(start, end)) + EM_CLOSE;
        position = end;
    });
    return html + escapeHtml(text.substring(position));
};

// Snippet text as HTML. `&` is kept, so the entities the backend may send still show
// as their characters.
const escapeSnippetText = (text) => escapeChars(text, /[<>"']/g);

/**
 * A result snippet from the search backend as HTML: its text as typed, keeping only the
 * `<em>` emphasis of the search terms and the ellipsis between fragments.
 *
 * An `<em>` inside another, or an `</em>` with none open, is shown as text, and an
 * `<em>` still open at the end is closed, so the emphasis never reaches past the snippet.
 *
 * @param {string} snippet - Snippet from the search backend
 * @returns {string} HTML of the snippet
 */
const snippetHtml = (snippet) => {
    const text = String(snippet ?? '');
    let html = '';
    let position = 0;
    let emphasisOpen = false;
    for (const match of text.matchAll(SNIPPET_MARKUP)) {
        const markup = match[0];
        html += escapeSnippetText(text.substring(position, match.index));
        if (markup === ELLIPSIS) {
            html += markup;
        } else if (markup === (emphasisOpen ? EM_CLOSE : EM_OPEN)) {
            html += markup;
            emphasisOpen = !emphasisOpen;
        } else {
            html += escapeSnippetText(markup);
        }
        position = match.index + markup.length;
    }
    return html + escapeSnippetText(text.substring(position)) + (emphasisOpen ? EM_CLOSE : '');
};

module.exports = { emphasizedHtml, snippetHtml };
