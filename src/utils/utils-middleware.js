
const utils = {
    isValidUrl: require('./is-valid-url'),
    sanitizeInputs: require('./sanitize-search-params'),
    dateToTimestamp: require('./date-to-timestamp'),
    timestampToText: require('./timestamp-to-text')
}
module.exports = function (req, res, next) {
    req.utils = utils;
    res.locals.utils = utils;
    next();
}