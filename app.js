const { resolveInclude } = require('ejs');
const express = require('express');
const config = require('config');
const session = require('cookie-session');
const cookies = require('cookie-parser');
const path = require('path');
const router = require('./src/router');
const trafficLogger = require('./src/logger/traffic-logger');
const errorLogger = require('./src/logger')('UnhandledException');
const { validateSessionSecret } = require('./src/utils/session-secret-validator');
const { parseTrustProxy } = require('./src/utils/trust-proxy');

validateSessionSecret(config.get('session.secret'), process.env.NODE_ENV);

const app = express();

app.disable('x-powered-by');
// Which proxies may set the client IP (req.ip) with X-Forwarded-For. Off by default.
app.set('trust proxy', parseTrustProxy(config.get('express.trust.proxy')));

const i18n = require('i18n-node-yaml')({
    debug: app.get('environment') !== 'production',
    translationFolder: path.join(__dirname, 'translations'),
    locales: ['en_GB', 'pt_PT'],
    defaultLocale: 'pt_PT',
    queryParameters: ['l'],
});

i18n.ready.catch(err => {
    require('./src/logger')('Server').error('Failed loading translations', err);
});

app.use(session({
    secret: config.get('session.secret'),
    saveUninitialized: true,
    cookie: { maxAge: config.get('session.length') },
    resave: false,
}));

app.use((req, res, next) => {
    res.locals.session = req.session;
    next();
});

app.use(cookies());

// Multipart bodies are only parsed on the Citation Saver POST (src/router.js, #177).

app.use((req, res, next) => {
    let requestLanguage = '';
    if (req.headers && req.headers['accept-language']) {
        requestLanguage = req.headers['accept-language'];
        req.headers['accept-language'] = null;
    }

    const locale = (req.cookies ? req.cookies.i18n : null) || 'pt_PT';
    let oldL = null;

    if (req.url.startsWith('/wayback') && !!req.query && !!req.query.l) {
        oldL = req.query.l;
        req.query.l = locale.split('_').shift();
    }
    i18n.middleware(req, res, () => {});

    res.cookie('i18n', locale, { httpOnly: false, maxAge: 900000 });

    if (req.headers && req.headers['accept-language'] === null) {
        req.headers['accept-language'] = requestLanguage;
    }
    if (!!oldL) {
        req.query.l = oldL;
    }
    next();
});

app.locals.config = config;

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static('./public'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const utils = require('./src/utils/utils-middleware');
app.use(utils);

app.use(trafficLogger);

app.use((req, res, next) => {
    res.locals.originalUrl = req.url;
    next();
});

app.use(router);

// Error handler: must be registered after every route so it receives their
// errors (#56). It replies with the generic status text itself, so the body never
// depends on NODE_ENV and never includes a stack or err.message. Client errors
// with a 4xx status (e.g. a malformed JSON body) keep it and are logged at warn
// without message or stack, since some messages quote the raw request body.
app.use((err, req, res, next) => { // Express needs all four parameters
    const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
    let line;
    try {
        line = status < 500 ? `Client error ${status} ${err.name}` : err.stack || String(err);
    } catch {
        line = '[non-Error value]'; // e.g. an object without toString passed to next()
    }
    if (status < 500) {
        errorLogger.warn(line);
    } else {
        errorLogger.error(line);
    }
    if (res.headersSent) {
        // Too late for an error reply: drop the connection, as Express's default
        // handler would, without logging the error a second time.
        res.destroy();
        return;
    }
    res.sendStatus(status);
});

module.exports = app;
