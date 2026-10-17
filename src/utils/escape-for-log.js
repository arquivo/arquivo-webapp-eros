'use strict';

// The backslash (so an escape in the value can't pass for one of ours), the C0 and C1
// control characters (CR, LF and tab among them), the Unicode line and paragraph
// separators, and the invisible format characters, among them the bidirectional ones
// that make a viewer show the text in another order.
const ESCAPED = /[\\\p{Cc}\p{Cf}\u2028\u2029]/gu;

/**
 * Escapes a value for a log line (CWE-117): its control and invisible format characters
 * become \uXXXX, e.g. "\r\n" becomes "\u000d\u000a", and a backslash becomes "\u005c". So a
 * user-supplied value can neither start a new line, nor add a field to a tab-separated one,
 * nor look different from what it is. Any other character is kept.
 *
 * @param {*} value - Value to log, converted to a string
 * @returns {string} The value, escaped; "[unprintable]" if it can't be converted to a string
 */
module.exports = function escapeForLog(value) {
    let text;
    try {
        text = String(value);
    } catch {
        return '[unprintable]'; // e.g. an object without a prototype, or whose toString throws
    }
    return text.replace(ESCAPED, c => String.raw`\u` + c.codePointAt(0).toString(16).padStart(4, '0'));
};
