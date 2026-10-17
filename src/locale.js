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
const COOKIE_OPTIONS = { maxAge: 900000, httpOnly: false, sameSite: 'lax' };
const WAYBACK_PREFIX = '/wayback';

/** 'en_GB' -> 'en' */
const localeLanguage = (locale) => locale.split('_').shift();

function setLocaleCookie(res, locale) {
    res.cookie(COOKIE_NAME, locale, COOKIE_OPTIONS);
}

/** The value if it is one of LOCALES, undefined otherwise */
const knownLocale = (value) => (LOCALES.includes(value) ? value : undefined);

/**
 * Calls fn with the [object, key, value] overrides applied (undefined removes
 * the key), then puts the original values back, even if fn throws.
 */
function withOverrides(overrides, fn) {
    const originals = overrides.map(([object, key]) => [object, key, Object.hasOwn(object, key), object[key]]);
    try {
        for (const [object, key, value] of overrides) {
            if (value === undefined) {
                delete object[key];
            } else {
                object[key] = value;
            }
        }
        return fn();
    } finally {
        for (const [object, key, had, value] of originals) {
            if (had) {
                object[key] = value;
            } else {
                delete object[key];
            }
        }
    }
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
        // Only a known locale is taken from the cookie; any other value (e.g. a
        // number or an object parsed from a 'j:' JSON cookie) is ignored.
        const cookie = knownLocale(req.cookies?.[COOKIE_NAME]);
        const cookieLocale = cookie || DEFAULT_LOCALE;

        // i18n-node-yaml's middleware picks the locale from the query parameter,
        // then the cookie, then Accept-Language, and has no option to skip
        // Accept-Language or to ignore the query parameter on some paths. So, only
        // for its call, Accept-Language is hidden, an ignored cookie is hidden, a
        // 'l' parameter that is not a string (repeated or nested) is hidden and,
        // on /wayback paths, the 'l' parameter is replaced by the cookie's
        // language. All are put back after, so the rest of the app sees the
        // request unchanged.
        const queryLanguage = req.query[QUERY_PARAMETER];
        let i18nQueryLanguage = typeof queryLanguage === 'string' ? queryLanguage : undefined;
        if (queryLanguage && req.url.startsWith(WAYBACK_PREFIX)) {
            i18nQueryLanguage = localeLanguage(cookieLocale);
        }
        withOverrides([
            [req.headers, 'accept-language', undefined],
            [req.query, QUERY_PARAMETER, i18nQueryLanguage],
            [req.cookies ?? {}, COOKIE_NAME, cookie],
        ], () => i18n.middleware(req, res, () => {}));

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
 * It only returns to the path of an http(s) referer on a trusted host
 * (localhost only outside production); otherwise, or without a referer, it
 * redirects to the homepage.
 */
function switchLanguage(req, res) {
    let refererUrl;
    try {
        refererUrl = new URL(req.headers.referer);
    } catch {
        // Missing or unparsable referer
        return res.redirect('/');
    }

    const validHosts = [new URL(config.get('backend.url')).hostname];
    if (req.app.get('env') !== 'production') {
        validHosts.push('localhost'); // to allow local testing
    }
    if (!['http:', 'https:'].includes(refererUrl.protocol) || !validHosts.includes(refererUrl.hostname)) {
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

    // Only a path on this site: one starting with a single '/'
    const target = refererUrl.pathname + refererUrl.search + refererUrl.hash;
    res.redirect(/^\/(?![/\\])/.test(target) ? target : '/');
}

module.exports = { localeMiddleware, switchLanguage };
