/**
 * Locale handling: which locale each request uses, the i18n cookie and the
 * /switchlang route.
 */
const path = require('node:path');
const config = require('config');
const createI18n = require('i18n-node-yaml');
const logger = require('./logger');

const LOCALES = ['en_GB', 'pt_PT'];
const DEFAULT_LOCALE = 'pt_PT';
const QUERY_PARAMETER = 'l';
const COOKIE_NAME = 'i18n';
const COOKIE_OPTIONS = { maxAge: 900000, httpOnly: false };
const WAYBACK_PREFIX = '/wayback';

/** 'en_GB' -> 'en' */
const localeLanguage = (locale) => locale.split('_').shift();

function setLocaleCookie(res, locale) {
    res.cookie(COOKIE_NAME, locale, COOKIE_OPTIONS);
}

/**
 * Middleware that selects the locale of the request and sets the i18n helpers
 * (getLocale, getLanguage, getLocales, t, ...) on req and res.locals.
 * Must come after cookie-parser.
 */
function localeMiddleware({ debug }) {
    const i18n = createI18n({
        debug,
        translationFolder: path.join(__dirname, '..', 'translations'),
        locales: LOCALES,
        defaultLocale: DEFAULT_LOCALE,
        queryParameters: [QUERY_PARAMETER],
        cookieName: COOKIE_NAME,
    });

    i18n.ready.catch(err => {
        logger('Server').error('Failed loading translations', err);
    });

    return function (req, res, next) {
        const cookieLocale = req.cookies?.[COOKIE_NAME] || DEFAULT_LOCALE;

        // i18n-node-yaml's middleware picks the locale from the query parameter,
        // then the cookie, then Accept-Language, and has no option to skip
        // Accept-Language or to ignore the query parameter on some paths. So, only
        // for its call, Accept-Language is hidden and, on /wayback paths, the 'l'
        // parameter is replaced by the cookie's language. Both are put back after,
        // so the rest of the app sees the request unchanged.
        const acceptLanguage = req.headers['accept-language'];
        const queryLanguage = req.query[QUERY_PARAMETER];
        const replaceQueryLanguage = queryLanguage && req.url.startsWith(WAYBACK_PREFIX);
        if (acceptLanguage) {
            req.headers['accept-language'] = null;
        }
        try {
            if (replaceQueryLanguage) {
                req.query[QUERY_PARAMETER] = localeLanguage(cookieLocale);
            }
            i18n.middleware(req, res, () => {});
        } finally {
            if (acceptLanguage) {
                req.headers['accept-language'] = acceptLanguage;
            }
            if (replaceQueryLanguage) {
                req.query[QUERY_PARAMETER] = queryLanguage;
            }
        }

        // Sets the i18n cookie again, after the one i18n-node-yaml set, to its own
        // value (or the default). Browsers keep the last one, so the 'l'
        // parameter only applies to this request.
        setLocaleCookie(res, cookieLocale);
        next();
    };
}

/**
 * GET /switchlang: switches to the other locale and redirects back to the
 * referer, with:
 * - the new locale in the i18n cookie
 * - the new language in the 'l' parameter (except for wayback paths)
 * - cache headers so the browser does not show the page in the old language
 * The referer must be on a trusted host; otherwise, or without a referer, it
 * redirects to the homepage.
 */
function switchLanguage(req, res) {
    if (!req.headers.referer) {
        return res.redirect('/');
    }
    const refererUrl = new URL(req.headers.referer);

    const validHosts = [
        'localhost', // to allow local testing
        new URL(config.get('backend.url')).hostname,
    ];
    if (!validHosts.includes(refererUrl.hostname)) {
        return res.redirect('/');
    }

    const currentLocale = req.getLocale();
    const newLocale = req.getLocales().find(locale => locale !== currentLocale);

    res.clearCookie(COOKIE_NAME);
    setLocaleCookie(res, newLocale);

    if (!refererUrl.pathname.startsWith(WAYBACK_PREFIX)) {
        refererUrl.searchParams.set(QUERY_PARAMETER, localeLanguage(newLocale));
    }

    res.set('Cache-control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    res.redirect(refererUrl.href.slice(refererUrl.origin.length));
}

module.exports = { localeMiddleware, switchLanguage };
