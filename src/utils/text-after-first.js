// The part of `text` after the first occurrence of `token`, or '' when `token`
// does not occur. For a non-empty token this is exactly
// text.split(token).filter((_, i) => i > 0).join(token).
module.exports = function textAfterFirst(text, token) {
    const index = text.indexOf(token);
    return index === -1 ? '' : text.slice(index + token.length);
};
