/**
 * Main Application Router
 * 
 * Defines all routes for the Arquivo.pt web archive application including:
 * - Search routes (pages, images, URLs)
 * - Advanced search interfaces
 * - Wayback Machine integration
 * - Services (Archive Page Now, Citation Saver)
 * - Tracking and analytics
 * - Language switching
 * - Backward compatibility redirects
 */

const backendRoutes = require('./backend-routes');
const healthcheckRoutes = require('./healthcheck-routes');
const searchPages = require('./search-pages.js');
const searchImages = require('./search-images.js');
const searchUrl = require('./search-url.js');
const archivePageNow = require('./services-archivepagenow');
const citationSaver = require('./services-citationsaver');
const wayback = require('./wayback');
const tracking = require('./tracking');
const replayNav = require('./replay-nav');
const replayTechnicalDetails = require('./replay-technical-details');
const isValidUrl = require('./utils/is-valid-url');
const express = require('express');
const router = express.Router();

// PyWb redirects; registered first so they take precedence over /wayback/:url*
backendRoutes(router);

healthcheckRoutes(router);

router.get('/', function (req, res) {
    res.render('pages/home');
});

/**
 * Page/Text Search Results
 * Handles search queries with smart routing:
 * - Empty query: shows homepage
 * - Valid URL: redirects to URL search
 * - Text query: shows page search results
 */
router.get('/page/search', function (req, res) {
    const requestData = req.utils.sanitizeInputs(req, res);

    if (!requestData.has('q') || requestData.get('q') == '') {
        res.render('pages/home');
    } else if (req.utils.isValidUrl(requestData.get('q'))) {
        res.redirect('/url/search?' + requestData.toString())
    } else {
        res.render('pages/pages-search-results', {
            requestData: requestData,
        });
    }
});

router.get('/url/search', function (req, res) {
    res.render('pages/replay-table-list-results', { requestData: req.utils.sanitizeInputs(req, res) });
});

/**
 * Image Search Results
 * Handles image queries with URL detection:
 * - Empty query: shows homepage with image search type
 * - Valid URL: converts to site: search
 * - Text query: shows image search results
 */
router.get('/image/search', function (req, res) {
    const requestData = req.utils.sanitizeInputs(req, res);
    if (!requestData.has('q') || requestData.get('q') == '') {
        res.render('pages/home', { searchType: 'images' });
    } else {
        if (req.utils.isValidUrl(requestData.get('q'))) {
            requestData.set('siteSearch', requestData.get('q'));
            requestData.set('q', 'site:' + requestData.get('q'));
        }
        res.render('pages/images-search-results', {
            requestData: requestData,
        });
    }
});

router.get('/pages', function (req, res) {
    res.render('pages/home',{searchType: 'pages'});
});

router.get('/images', function (req, res) {
    res.render('pages/home',{searchType: 'images'});
});

router.get('/page/advanced/search', function (req, res) {
    res.render('pages/pages-advanced-search', { requestData: req.utils.sanitizeInputs(req, res) });
});

router.get('/image/advanced/search', function (req, res) {
    res.render('pages/images-advanced-search',{ requestData: req.utils.sanitizeInputs(req, res) });
});

// /wayback/*/<url>: a valid URL goes to the URL search, anything else to the page search
router.get('/wayback/[*]/:url*', function (req, res) {
    const requestUrl = req.params.url + (req.params['0'] ?? '');
    const requestData = new URLSearchParams({q:requestUrl});
    if (req.utils.isValidUrl(requestUrl)) {
        res.redirect('/url/search?' + requestData.toString())
    } else {
        res.render('pages/pages-search-results', {
            requestData: requestData,
        });
    }
});

router.get('/wayback/:url*', function (req, res) {
    wayback(req, res);
});

router.get('/page/view/:url*', function (req, res) {
    tracking(req, res,'PageView');
});

router.get('/image/view/:url*', function (req, res) {
    tracking(req, res,'ImageView');
});

/**
 * Switch Language Route
 * Toggles between available locales and redirects back to referrer with:
 * - Updated i18n cookie
 * - Language parameter in URL (for non-wayback routes)
 * - Cache headers to prevent stale content
 * - Security: validates referrer hostname against whitelist
 */
router.get('/switchlang', function (req, res) {
    if(!!req.headers && req.headers.referer){
        let oldUrl = req.headers.referer;
        let parsedUrl = new URL(oldUrl);

        const config = require('config')

        // Security: only allow switching from trusted hosts
        const validHosts = [
            'localhost', // to allow local testing
            (new URL(config.get('backend.url'))).hostname
        ]
        if(!validHosts.includes(parsedUrl.hostname)){
            return res.redirect('/');
        }
        
        // Toggle to the other available locale
        let currentLocale = req.getLocale();
        let newLocale = req.getLocales().find(l => l!=currentLocale);
        
        // Update language cookie
        res.clearCookie('i18n');
        res.cookie('i18n', newLocale, { maxAge: 900000, httpOnly: false });
        
        // Add language parameter to URL (except for wayback routes)
        if(!parsedUrl.pathname.startsWith('/wayback')){
            parsedUrl.searchParams.set('l',newLocale.split('_').shift());
        }

        const newUrl = parsedUrl.href.slice(parsedUrl.origin.length);

        // Prevent browser caching from showing stale language
        res.set('Cache-control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');

        res.redirect(newUrl);
        
    } else {
        res.redirect('/');
    }
});

router.get('/services/citationsaver', function (req, res) {
    res.render('pages/services-citation-saver');
});

router.post('/services/citationsaver', citationSaver.rateLimiter, citationSaver.parseUpload, function (req, res, next) {
    citationSaver(req, res).catch(next);
});

/** Render a partial template as-is, without the page layout */
const renderPartial = (view) => (req, res) => res.render(view, { layout: false });

/**
 * Partial handlers keyed by partial id. This is the allowlist: any other id
 * falls through to the 404 page. The id comes straight from the URL (Express
 * decodes '%2F', and a '.' changes the view engine Express require()s), so it
 * is never used to build a view name (#174).
 * A Map (not a plain object) so ids like 'constructor' or '__proto__'
 * never resolve to prototype properties.
 */
const partialHandlers = new Map([
    // Search results partials
    ['pages-search-results', searchPages],
    ['images-search-results', searchImages],
    ['url-search-results', searchUrl],
    // Wayback replay partials
    ['replay-nav', replayNav],
    ['replay-technical-details', replayTechnicalDetails],
    // Modal partials
    ['modal-datepicker', renderPartial('partials/modal-datepicker')],       // public/js/datepicker.js
    ['modal-image-details', renderPartial('partials/modal-image-details')], // public/js/modal-image-result.js
]);

// Partials are loaded via AJAX, without a full page refresh
router.get('/partials/:id', function (req, res, next) {
    const handler = partialHandlers.get(req.params.id);
    if (handler) {
        handler(req, res, next);
    } else {
        next();
    }
});

// Backward compatibility: the old name of the Archive Page Now service
router.get('/services/savepagenow', function (req, res) {
    const requestData = new URLSearchParams(req.query);
    res.redirect('/services/archivepagenow?'+requestData.toString());
});

router.get('/services/archivepagenow', function (req, res) {
    const requestData = new URLSearchParams(req.query);
    const rawUrl = (requestData.get('url') ?? '').trim();
    res.render('pages/services-archivepagenow', {
        url: isValidUrl(rawUrl) ? rawUrl : '',
        error: false
    });
});

/**
 * If 'logging' parameter is present, skip processing (logging endpoint)
 * Otherwise, process the URL for archiving
 */
router.post('/services/archivepagenow', function (req, res) {
    const requestData = new URLSearchParams(req.query);
    if (!requestData.has('logging')) {
        archivePageNow(req, res);
    } else {
        res.end();
    }
});

// Complete Page: displays the patched reconstruction of an archived page
router.get('/services/complete-page', function (req, res) {
    const requestData = new URLSearchParams(req.query);
    const rawUrl = decodeURIComponent(requestData.get('url') ?? '');
    requestData.set('url', isValidUrl(rawUrl) ? rawUrl : '');
    res.render('pages/services-complete-page', {
        requestData: requestData,
    });
});

// 404: must be the last route, so it only catches unmatched requests
router.use(function (req, res, next) {
    res.status(404).render('pages/arquivo-404');
});

module.exports = router;