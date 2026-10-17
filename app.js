const { resolveInclude } = require('ejs');
const fileUpload = require('express-fileupload');
const express = require('express');
const config = require('config');
const session = require('cookie-session');
const cookies = require('cookie-parser');
const http = require('http');
const path = require('path');
const router = require('./src/router');
const trafficLogger = require('./src/logger/traffic-logger');
const errorLogger = require('./src/logger')('UnhandledException');
const { validateSessionSecret } = require('./src/utils/session-secret-validator');

validateSessionSecret(config.get('session.secret'), process.env.NODE_ENV);

const app = express();

app.disable('x-powered-by');

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

app.use(fileUpload({
    createParentPath: true,
}));

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
// errors (#56). It replies with a generic message itself, rather than calling
// next(err), so the body never depends on NODE_ENV and never includes a stack.
// Client errors that carry a 4xx status (e.g. a malformed JSON body) keep it.
app.use((err, req, res, next) => {
    errorLogger.error((err && err.stack) || String(err));
    if (res.headersSent) {
        // Too late to send an error page: let Express close the connection.
        return next(err);
    }
    const errStatus = err && (err.status || err.statusCode);
    const status = errStatus >= 400 && errStatus < 500 ? errStatus : 500;
    res.status(status).type('text/plain').send(http.STATUS_CODES[status]);
});

module.exports = app;
