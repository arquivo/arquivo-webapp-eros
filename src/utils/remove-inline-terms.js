/**
 * Removes every inline term (e.g. "collection:EAWP6") of the given parameters from a query,
 * together with the whitespace before it
 *
 * Works on whitespace separated tokens rather than with a `\s+name:\S+` regular expression, which
 * is quadratic on long whitespace runs, so it stays linear in the query length.
 *
 * @param {string} query - Search query
 * @param {string[]} inlineParams - Inline parameter names, e.g. ['collection', 'language']
 * @returns {string} Query without those terms
 */
module.exports = function removeInlineTerms(query, inlineParams) {
  const inlineTerm = new RegExp(String.raw`^(?:${inlineParams.join('|')}):\S+$`);
  // with the capturing group, words are at even indexes and the whitespace between them at odd ones
  const tokens = query.split(/(\s+)/);
  return tokens
    .filter((token, index) => !inlineTerm.test(index % 2 ? tokens[index + 1] : token))
    .join('')
    .trim();
};
