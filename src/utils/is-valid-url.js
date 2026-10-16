const { URL, domainToUnicode } = require('node:url');

// Characters the previous regex never accepted anywhere in a URL: whitespace,
// ASCII control characters, quotes, angle brackets, backtick, backslash, caret,
// pipe and square brackets. The WHATWG parser would silently percent-encode or
// strip them, but callers render the raw input (`<%- url %>` in
// services-archivepagenow-save.ejs), so they stay rejected. A single character
// class, so matching is linear in the input length.
const FORBIDDEN_CHAR = /[\s\x00-\x1f\x7f"'<>`\\^|[\]]/;
const HTTP_SCHEME = /^https?:\/\//i;
const STARTS_WITH_LETTER_OR_DIGIT = /^[\p{L}\p{N}]/u;
// A top-level domain is made of letters only (`pt`, `com`, `рф`, `中国`).
const TOP_LEVEL_LABEL = /^[\p{L}\p{M}]{2,}$/u;

/**
 * Whether `s` looks like an http(s) URL of a named host, with or without the
 * scheme (`publico.pt`, `https://www.sapo.pt/path?x=1`).
 *
 * Parsing is done by the WHATWG URL parser. The checks around it keep the
 * search-routing contract: plain words, numbers, IP addresses, e-mail
 * addresses / credentials and non-http(s) schemes (`ftp:`, `javascript:`,
 * `data:`) are not URLs.
 *
 * @param {string} s
 * @returns {boolean}
 */
module.exports = function isValidUrl(s) {
  if (typeof s !== 'string') return false;
  const trimmed = s.trim();
  if (trimmed === '' || FORBIDDEN_CHAR.test(trimmed)) return false;

  const hasScheme = HTTP_SCHEME.test(trimmed);
  const rest = hasScheme ? trimmed.slice(trimmed.indexOf('//') + 2) : trimmed;
  if (!STARTS_WITH_LETTER_OR_DIGIT.test(rest)) return false;

  let url;
  try {
    // Without a scheme, `javascript:x` / `data:x` / `ftp://x` end up as an
    // invalid port or a dotless host, and are rejected below.
    url = new URL(hasScheme ? trimmed : 'https://' + trimmed);
  } catch {
    return false;
  }
  if (url.username || url.password) return false;

  // Require a named host: at least one dot and a top-level label of 2+
  // letters. WHATWG parses numeric queries such as `3.14` or `2024` as IPv4
  // hosts (`3.0.0.14`, `0.0.7.232`); their numeric last label fails this
  // check, as do bracketed IPv6 hosts, versions (`v2.0rc1`) and amounts
  // (`3.5mm`, `3.50€`).
  let hostname = domainToUnicode(url.hostname);
  if (hostname.endsWith('.')) hostname = hostname.slice(0, -1);
  const dot = hostname.lastIndexOf('.');
  return dot > 0 && TOP_LEVEL_LABEL.test(hostname.slice(dot + 1));
};
