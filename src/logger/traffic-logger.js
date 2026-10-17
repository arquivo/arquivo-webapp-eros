'use strict';

const expressWinston = require('express-winston');
const winston = require('winston');
const getDefaults = require('./default.config');
const escapeForLog = require('../utils/escape-for-log');

// The pattern of the route that handled the request, e.g. "/wayback/:url*", never the
// path itself: paths carry archived URLs (/wayback/<timestamp>/<url>, /page/view/…) and
// search terms (/wayback/*/<terms>). "-" when no route matched, e.g. an unknown path.
// req.baseUrl is the matched mount path, not a pattern: this is safe only while every
// router is mounted at a fixed path (today, "/").
function routePattern(req) {
    return req.route ? escapeForLog(req.baseUrl + req.route.path) : '-';
}

// Like expressFormat ("GET /search?q=… 200 12ms"), but with the route pattern instead of
// the URL. msg stays a fixed template (express-winston compiles what a msg function returns
// as a template); it reads req.routePattern once the response is over and the route known.
const logRequest = expressWinston.logger({
    // A logger of its own, so that logger.level filters these lines too. Given the level
    // option instead, express-winston would write every request at that level.
    winstonInstance: winston.createLogger(getDefaults('Traffic')),
    meta: false, // no request metadata (headers, query) is collected; the format only prints the message
    msg: '{{req.method}} {{req.routePattern}} {{res.statusCode}} {{res.responseTime}}ms',
    ignoreRoute: function () { return false; } // optional: allows to skip some log messages based on request and/or response
});

module.exports = function trafficLogger(req, res, next) {
    Object.defineProperty(req, 'routePattern', { get: () => routePattern(req), configurable: true });
    logRequest(req, res, next);
};
