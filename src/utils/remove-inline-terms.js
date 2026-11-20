'use strict';

// Double quoted phrases, paired from left to right like sanitize-search-params pairs them.
// With the capturing group, split puts the phrases at odd indexes and the text between them at even ones.
const PHRASES = /("[^"]*")/;

// Removes the words matching inlineTerm, each with the whitespace before it
const removeMatchingWords = (text, inlineTerm) => {
  // with the capturing group, words are at even indexes and the whitespace between them at odd ones
  const tokens = text.split(/(\s+)/);
  return tokens
    .filter((token, index) => !inlineTerm.test(index % 2 ? tokens[index + 1] : token))
    .join('');
};

/**
 * Removes every inline term (e.g. "collection:EAWP6") of the given parameters from a query,
 * together with the whitespace before it
 *
 * Works on whitespace separated tokens rather than with a `\s+name:\S+` regular expression, which
 * is quadratic on long whitespace runs, so it stays linear in the query length.
 *
 * @param {string} query - Search query
 * @param {string[]} inlineParams - Inline parameter names, e.g. ['collection', 'language']
 * @param {Object} [options]
 * @param {boolean} [options.keepPhrases=false] - Keep the terms inside double quoted phrases, which
 *     are searched as typed rather than read as inline terms
 * @returns {string} Query without those terms
 */
module.exports = function removeInlineTerms(query, inlineParams, { keepPhrases = false } = {}) {
  const inlineTerm = new RegExp(String.raw`^(?:${inlineParams.join('|')}):\S+$`);
  const parts = keepPhrases ? query.split(PHRASES) : [query];
  return parts
    .map((part, index) => index % 2 ? part : removeMatchingWords(part, inlineTerm))
    .join('')
    .trim();
};
