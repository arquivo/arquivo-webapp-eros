const { URL, domainToUnicode } = require('node:url');

// Characters never accepted anywhere in a URL:
// - whitespace, quotes, angle brackets, backtick, backslash, caret, pipe and
//   square brackets (the set the previous regex rejected). The WHATWG parser
//   would silently percent-encode or strip them, but callers render the raw
//   input (`<%- url %>` in services-archivepagenow-save.ejs), so they stay
//   rejected;
// - C0/C1 control characters (`\p{Cc}`) and invisible format characters that
//   can spoof the displayed URL or inject into log lines: bidi embeddings and
//   overrides (U+202A-U+202E), bidi isolates (U+2066-U+2069), zero-width space
//   (U+200B), BOM (U+FEFF) and soft hyphen (U+00AD). Not all of `\p{Cf}`:
//   ZWJ/ZWNJ (U+200D/U+200C) are needed by some legitimate IDNs.
// A single character class, so matching is linear in the input length.
const FORBIDDEN_CHAR = /[\s\p{Cc}"'<>`\\^|[\]\u00AD\u200B\u202A-\u202E\u2066-\u2069\uFEFF]/u;
const HTTP_SCHEME = /^https?:\/\//i;
// WHATWG drops extra leading slashes and an empty userinfo, so `//x.com`,
// `https:///x.com` and `@x.com` would parse as `x.com`; it also allows
// `-x.com` and `*.x.com`. Requiring a letter or digit first keeps them text.
const STARTS_WITH_LETTER_OR_DIGIT = /^[\p{L}\p{N}]/u;
// A top-level domain is made of letters (`pt`, `com`, `рф`, `中国`) plus
// combining marks (`\p{M}`), which some scripts need (`भारत`).
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
 * Any `word.word` token whose last label is 2+ letters is a URL, accented or
 * not: `Sr.Silva` and `Sr.José` both go to URL search. Trailing punctuation
 * after the TLD (`publico.pt,`, `Viva.Portugal!`) makes it text.
 *
 * @param {string} s
 * @returns {boolean}
 */
module.exports = function isValidUrl(s) {
  if (typeof s !== 'string') return false;
  const trimmed = s.trim();
  if (FORBIDDEN_CHAR.test(trimmed)) return false;

  // `http:` and `https:` parse the same way, so always parse as `https://`.
  const rest = trimmed.replace(HTTP_SCHEME, '');
  if (!STARTS_WITH_LETTER_OR_DIGIT.test(rest)) return false;

  let url;
  try {
    // Without a scheme, `javascript:alert(1)` ends up as an invalid port
    // (throws) and `javascript:80/x.com` as a dotless host (rejected below).
    url = new URL('https://' + rest);
  } catch {
    return false;
  }
  // E-mail addresses and credentials are not URLs. This check is also what
  // rejects `javascript:x@evil.com` and `javascript:@evil.com`, which parse
  // as user `javascript` on host `evil.com`.
  if (url.username || url.password) return false;

  // Require a named host: at least one dot and a top-level label of 2+
  // letters. WHATWG parses numeric queries such as `3.14` or `2024` as IPv4
  // hosts (`3.0.0.14`, `0.0.7.232`); their numeric last label fails this
  // check, as do bracketed IPv6 hosts, versions (`v2.0rc1`) and amounts
  // (`3.5mm`, `3.50€`). Together with the credentials check above, this is
  // what keeps `javascript:` input out: its "host" is the dotless
  // `javascript`.
  let hostname = domainToUnicode(url.hostname);
  if (hostname.endsWith('.')) hostname = hostname.slice(0, -1);
  const dot = hostname.lastIndexOf('.');
  return dot > 0 && TOP_LEVEL_LABEL.test(hostname.slice(dot + 1));
};
