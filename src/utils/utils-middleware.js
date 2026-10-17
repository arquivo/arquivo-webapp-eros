'use strict';

const utils = {
    isValidUrl: require('./is-valid-url'),
    asciiHost: require('./display-url').asciiHost,
    displayUrl: require('./display-url').displayUrl,
    sanitizeInputs: require('./sanitize-search-params'),
    dateToTimestamp: require('./date-to-timestamp'),
    timestampToText: require('./timestamp-to-text')
}
module.exports = function (req, res, next) {
    req.utils = utils;
    res.locals.utils = utils;
    next();
}