'use strict';

const { URL } = require('node:url');

// The authority (userinfo, host and port) of an http(s) URL as written. Like
// the WHATWG parser, any number of `/` or `\` may follow the scheme.
const HTTP_AUTHORITY = /^https?:[/\\]*([^/\\?#]*)/i;
const NON_ASCII = /\P{ASCII}/u;
const TAB_OR_NEWLINE = /[\t\n\r]/g;
const FIRST_STRONG_ISOLATE = '⁨';
const POP_DIRECTIONAL_ISOLATE = '⁩';

// The WHATWG parser's preprocessing: strip leading and trailing C0 controls
// and spaces, then remove every tab and newline.
function preprocess(s) {
  let start = 0;
  let end = s.length;
  while (start < end && s.charCodeAt(start) <= 0x20) start++;
  while (end > start && s.charCodeAt(end - 1) <= 0x20) end--;
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
 * is isolated (so bidi controls in it can't reorder what follows) and followed
 * by that host in parentheses. Otherwise `text` is returned unchanged.
 *
 * @param {*} url
 * @param {*} [text=url]
 * @returns {*}
 */
function displayUrl(url, text = url) {
  const host = asciiHost(url);
  return host ? `${FIRST_STRONG_ISOLATE}${text}${POP_DIRECTIONAL_ISOLATE} (${host})` : text;
}

module.exports = { asciiHost, displayUrl };
