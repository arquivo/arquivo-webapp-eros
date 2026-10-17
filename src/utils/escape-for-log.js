'use strict';

// C0 and C1 control characters (CR, LF and tab among them) and the Unicode line and
// paragraph separators.
const CONTROL_CHARACTERS = /[\p{Cc}\u2028\u2029]/gu;

/**
 * Escapes the control characters of a value for a log line (CWE-117), e.g. "\r\n" becomes
 * "\u000d\u000a", so a user-supplied value can neither start a new line nor add a field to
 * a tab-separated one. Any other character is kept.
 *
 * @param {*} value - Value to log, converted to a string
 * @returns {string} The value, with its control characters escaped
 */
module.exports = function escapeForLog(value) {
    return String(value).replace(CONTROL_CHARACTERS,
        c => '\\u' + c.codePointAt(0).toString(16).padStart(4, '0'));
};
