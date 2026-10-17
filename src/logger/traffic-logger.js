'use strict';

const expressWinston = require('express-winston');
const getDefaults = require('./default.config');

// Like expressFormat ("GET /search?q=… 200 12ms"), but with the path only: the query
// string (search terms and other user input) is never logged. The path comes from the
// raw request line, where Node's HTTP parser accepts no control characters. msg stays a
// fixed template: express-winston compiles what a msg function returns as a template.
module.exports = expressWinston.logger({
    ...getDefaults('Traffic'),
    meta: false, // no request metadata (headers, query) is collected; the format only prints the message
    msg: '{{req.method}} {{req.path}} {{res.statusCode}} {{res.responseTime}}ms',
    ignoreRoute: function () { return false; } // optional: allows to skip some log messages based on request and/or response
})
