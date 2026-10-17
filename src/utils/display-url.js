'use strict';

const { URL } = require('node:url');

// The authority (userinfo, host and port) of an http(s) URL as written: what
// follows the scheme and its slashes, up to the path, query or fragment. The
// WHATWG parser treats `\` as `/` and accepts any number of slashes in http(s)
// URLs, so this does too.
const HTTP_AUTHORITY = /^https?:[/\\]*([^/\\?#]*)/i;
const NON_ASCII = /\P{ASCII}/u;

/**
 * Text to show for an http(s) URL whose authority is written with non-ASCII
 * characters (an internationalised domain name): `text` followed by the host
 * in the ASCII (punycode) form the browser resolves, as in
 * `http://exämple.pt/ (xn--exmple-cua.pt)`. Lookalike characters from other
 * scripts (Cyrillic `а` in `pаypal.com`) thus show up as `xn--` labels. The
 * whole authority is checked, so non-ASCII user info (`http://аpple.com@x.pt`)
 * also shows the host actually used (`x.pt`).
 *
 * Any other value (ASCII hosts, IP addresses, other schemes, values that are
 * not URLs or not strings) gives back `text` unchanged. Never throws.
 *
 * @param {*} url the URL to inspect
 * @param {*} [text=url] the text shown for it, e.g. the URL without its scheme
 * @returns {*} the text to show
 */
module.exports = function displayUrl(url, text = url) {
  if (typeof url !== 'string' || typeof text !== 'string') return text;
  const authority = HTTP_AUTHORITY.exec(url);
  if (!authority || !NON_ASCII.test(authority[1])) return text;
  try {
    // http(s) URLs always have a host: one without it does not parse.
    return `${text} (${new URL(url).hostname})`;
  } catch {
    return text;
  }
};
