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
const searchPages = require('./search-pages.js');
const searchImages = require('./search-images.js');
const searchUrl = require('./search-url.js');
const archivePageNow = require('./services-archivepagenow');
const citationSaver = require('./services-citationsaver');
const wayback = require('./wayback');
const tracking = require('./tracking');
const replayNav = require('./replay-nav');
const replayTechnicalDetails = require('./replay-technical-details');
const express = require('express');
const router = express.Router();

// ============================================================================
// Backend Routes - PyWb proxy redirects (must be registered first)
// ============================================================================
backendRoutes(router);

// ============================================================================
// Homepage
// ============================================================================
router.get('/', function (req, res) {
    res.render('pages/home');
});

// ============================================================================
// Search Routes
// ============================================================================

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

/**
 * URL Search Results
 * Displays timeline/history of captures for a specific URL
 */
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

// ============================================================================
// Landing Pages
// ============================================================================

/** Page/Text search landing page */
router.get('/pages', function (req, res) {
    res.render('pages/home',{searchType: 'pages'});
});

/** Image search landing page */
router.get('/images', function (req, res) {
    res.render('pages/home',{searchType: 'images'});
});

// ============================================================================
// Advanced Search Forms
// ============================================================================

/** Page/Text advanced search interface */
router.get('/page/advanced/search', function (req, res) {
    res.render('pages/pages-advanced-search', { requestData: req.utils.sanitizeInputs(req, res) });
});

/** Image advanced search interface */
router.get('/image/advanced/search', function (req, res) {
    res.render('pages/images-advanced-search',{ requestData: req.utils.sanitizeInputs(req, res) });
});

// ============================================================================
// Wayback Machine Routes
// ============================================================================

/**
 * Wayback wildcard route
 * Handles URLs with wildcard patterns, routing to URL or page search
 */
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

/**
 * Wayback replay route
 * Displays archived content for a specific timestamp/URL combination
 */
router.get('/wayback/:url*', function (req, res) {
    wayback(req, res);
});

// ============================================================================
// Tracking Routes
// ============================================================================

/** Track page views in archived content */
router.get('/page/view/:url*', function (req, res) {
    tracking(req, res,'PageView');
});

/** Track image views in archived content */
router.get('/image/view/:url*', function (req, res) {
    tracking(req, res,'ImageView');
});

// ============================================================================
// Language Switching
// ============================================================================

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
            res.redirect('/');
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

// ============================================================================
// Services
// ============================================================================

/** Citation Saver - Form display */
router.get('/services/citationsaver', function (req, res) {
    res.render('pages/services-citation-saver');
});

/** Citation Saver - Form submission handler */
router.post('/services/citationsaver', function (req, res) {
    citationSaver(req,res);
});

// ============================================================================
// Partial Content Routes
// Dynamic partials loaded via AJAX for search results and wayback navigation
// ============================================================================

/**
 * Dynamic Partials Router
 * Routes partial template requests to appropriate handlers or renders generic partial
 * Used for AJAX content loading without full page refresh
 */
router.get('/partials/:id', function (req, res) {
    // Search results partials
    if (req.params.id == 'pages-search-results') {
        searchPages(req, res);
    } else if (req.params.id == 'images-search-results') {
        searchImages(req, res);
    } else if (req.params.id == 'url-search-results') {
        searchUrl(req, res);
    } 
    // Wayback replay partials
    else if (req.params.id == 'replay-nav') {
        replayNav(req, res);
    } else if (req.params.id == 'replay-technical-details') {
        replayTechnicalDetails(req, res);
    } 
    // Generic partial template
    else {
        res.render('partials/' + req.params.id, { layout: false });
    }
});

// ============================================================================
// Backward Compatibility Redirects
// ============================================================================

/** Redirect old service name to new one */
router.get('/services/savepagenow', function (req, res) {
    const requestData = new URLSearchParams(req.query);
    res.redirect('/services/archivepagenow?'+requestData.toString());
});

// ============================================================================
// Archive Page Now Service
// ============================================================================

/** Archive Page Now - Display submission form */
router.get('/services/archivepagenow', function (req, res) {
    const requestData = new URLSearchParams(req.query);
    res.render('pages/services-archivepagenow', {
        url: (requestData.get('url') ?? '').trim(),
        error: false
    });
});

/**
 * Archive Page Now - Process URL submission
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

// ============================================================================
// Additional Services
// ============================================================================

/** Complete Page Service - Display patched page reconstruction */
router.get('/services/complete-page', function (req, res) {
    const requestData = new URLSearchParams(req.query);
    requestData.set('url', decodeURIComponent(requestData.get('url')));
    res.render('pages/services-complete-page', {
        requestData: requestData,
    });
});

// ============================================================================
// 404 Error Handler
// Must be last route to catch all unmatched requests
// ============================================================================
router.use(function (req, res, next) {
    res.status(404).render('pages/arquivo-404');
});

module.exports = router;