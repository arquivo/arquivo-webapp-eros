
const utils = {
    isValidUrl: require('./is-valid-url'),
    sanitizeInputs: require('./sanitize-search-params')
}
module.exports = {
    api:utils,
    middleware: function (req, res, next) {
        req.utils = utils;
        next();
    }
}