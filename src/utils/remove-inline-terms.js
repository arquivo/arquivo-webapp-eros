/**
 * Removes every inline term (e.g. "collection:EAWP6") of the given parameters from a query
 *
 * @param {string} query - Search query
 * @param {string[]} inlineParams - Inline parameter names, e.g. ['collection', 'language']
 * @returns {string} Query without those terms
 */
module.exports = function (query, inlineParams) {
  const regex = new RegExp(String.raw`(?:^|\s+)(?:${inlineParams.join('|')}):\S+`, 'g');
  return query.replace(regex, '').trim();
};
