
const utils = {
    isValidUrl: require('./is-valid-url'),
    sanitizeInputs: require('./sanitize-search-params')
}
module.exports = function (req, res, next) {
    req.utils = utils;
    res.locals.utils = utils;
    next();
}