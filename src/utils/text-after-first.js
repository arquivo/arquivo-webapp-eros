'use strict';

// The part of `text` after the first occurrence of the non-empty `token`, or ''
// when `token` does not occur.
module.exports = function textAfterFirst(text, token) {
    const index = text.indexOf(token);
    return index === -1 ? '' : text.slice(index + token.length);
};
