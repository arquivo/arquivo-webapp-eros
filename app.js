const { resolveInclude } = require('ejs');
const fileUpload = require('express-fileupload');
const express = require('express');
const config = require('config');
const session = require('cookie-session');
const cookies = require('cookie-parser');
const path = require('path');
const router = require('./src/router');
const trafficLogger = require('./src/logger/traffic-logger');
const { validateSessionSecret } = require('./src/utils/session-secret-validator');

validateSessionSecret(config.get('session.secret'), process.env.NODE_ENV);

const app = express();

app.use((err, req, res, next) => {
    require('./src/logger')('UnhandledException').error(err.stack);
    next(err);
});

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

module.exports = app;
