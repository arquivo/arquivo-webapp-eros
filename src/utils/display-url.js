'use strict';

const { URL } = require('node:url');

// The authority (userinfo, host and port) of an http(s) URL as written. Like
// the WHATWG parser, any number of `/` or `\` may follow the scheme.
const HTTP_AUTHORITY = /^https?:[/\\]*([^/\\?#]*)/i;
const NON_ASCII = /\P{ASCII}/u;
const TAB_OR_NEWLINE = /[\t\n\r]/g;
const FIRST_STRONG_ISOLATE = '\u2068';
const POP_DIRECTIONAL_ISOLATE = '\u2069';
// ALM, LRM, RLM, the embeddings and overrides (LRE to RLO) and the isolates
// (LRI to PDI).
const BIDI_CONTROLS = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

// The WHATWG parser's preprocessing: strip leading and trailing C0 controls
// and spaces, then remove every tab and newline.
function preprocess(s) {
  let start = 0;
  let end = s.length;
  while (start < end && s.codePointAt(start) <= 0x20) start++;
  while (end > start && s.codePointAt(end - 1) <= 0x20) end--;
  return s.slice(start, end).replace(TAB_OR_NEWLINE, '');
}

/**
 * The host, in the ASCII (punycode) form the browser resolves, of an http(s)
 * URL whose authority is written with non-ASCII characters
 * (`http://exämple.pt/` gives `xn--exmple-cua.pt`); otherwise `''`.
 * Never throws.
 *
 * @param {*} url
 * @returns {string}
 */
function asciiHost(url) {
  if (typeof url !== 'string') return '';
  const input = preprocess(url);
  const authority = HTTP_AUTHORITY.exec(input);
  if (!authority || !NON_ASCII.test(authority[1])) return '';
  try {
    return new URL(input).hostname;
  } catch {
    return '';
  }
}

/**
 * Plain-text form of `text` (by default the URL itself) for places that can't
 * hold markup, such as a `title`: when `url` has an {@link asciiHost}, `text`
 * is stripped of bidi controls, isolated (so it can't reorder what follows) and
 * followed by that host in parentheses. Otherwise `text` is returned unchanged.
 *
 * @param {*} url
 * @param {*} [text=url]
 * @returns {*}
 */
function displayUrl(url, text = url) {
  const host = asciiHost(url);
  if (!host) return text;
  const isolated = String(text).replace(BIDI_CONTROLS, '');
  return `${FIRST_STRONG_ISOLATE}${isolated}${POP_DIRECTIONAL_ISOLATE} (${host})`;
}

module.exports = { asciiHost, displayUrl };
