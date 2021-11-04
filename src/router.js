const backendRoutes = require('./backend-routes');
const searchPages = require('./search-pages.js');
const searchImages = require('./search-images.js');
const searchUrl = require('./search-url.js');
const savePageNow = require('./services-savepagenow');
const wayback = require('./wayback');
const tracking = require('./tracking');
const replayNav = require('./replay-nav');
const { request } = require('express');

module.exports = function (app) {

    //Backend routes
    backendRoutes(app);

    // Homepage 
    app.get('/', function (req, res) {
        res.render('pages/home');
    });

    // Pages search results
    app.get('/page/search', function (req, res) {
        const requestData = req.utils.sanitizeInputs(req, res);

        if (!requestData.has('q') || requestData.get('q') == '') {
            res.render('pages/home');
        } else if(req.utils.isValidUrl(requestData.get('q'))){
            res.redirect('/url/search?'+requestData.toString())
        } else {
            res.render('pages/pages-search-results', {
                requestData: requestData,
            });
        }
    });
    app.get('/url/search', function (req, res) {
        res.render('pages/replay-table-list-results', {requestData: req.utils.sanitizeInputs(req, res) });
    });

    // Images search results
    app.get('/image/search', function (req, res) {
        const requestData = req.utils.sanitizeInputs(req, res);
        if (!requestData.has('q') || requestData.get('q') == '') {
            res.render('pages/home',{searchType:'images'});
        } else {
            if(req.utils.isValidUrl(requestData.get('q'))){
                requestData.set('siteSearch',requestData.get('q'));
                requestData.set('q','site:'+requestData.get('q'));
            }
            res.render('pages/images-search-results', {
                requestData: requestData,
            });
        }
    });

    // Pages: landing page
    app.get('/pages', function (req, res) {

        res.render('pages/pages');
    });

    // Pages advanced search
    app.get('/page/advanced/search', function (req, res) {
        res.render('pages/pages-advanced-search',{requestData:req.utils.sanitizeInputs(req, res)});
    });

    // Images: landing page
    app.get('/images', function (req, res) {

        res.render('pages/images');
    });

    // Images: advanced search
    app.get('/images-advanced-search', function (req, res) {
        res.render('pages/images-advanced-search');
    });
    app.get('/image/advanced/search', function (req, res) {
        res.render('pages/images-advanced-search');
    });

    // starts wayback
    app.get('/wayback/:url*', function (req, res) {
        wayback(req,res);
    });
    // page/view for tracking purposes
    app.get(['/page/view/:url*','/image/view/:url*'], function (req, res) {
        tracking(req,res);
    });


    // starts partials
    app.get('/partials/:id', function (req, res) {
        if (req.params.id == 'pages-search-results') {
            searchPages(req, res);
        } else if(req.params.id == 'images-search-results') {
            searchImages(req, res);
        } else if(req.params.id == 'url-search-results') {
            searchUrl(req, res);
        } else if(req.params.id == 'replay-nav') {
            replayNav(req, res);
        } else {
            res.render('partials/' + req.params.id, { layout: false });
        }
    });

    // savepagenow form
    app.get('/services/savepagenow', function (req, res) {
        const requestData = new URLSearchParams(req.query);
        res.render('pages/services-savepagenow',{
            url: (requestData.get('url') ?? '').trim(),
            error: false
        });
    });

    // savepagenow recording page
    app.post('/services/savepagenow', function (req, res) {
        const requestData = new URLSearchParams(req.query);
        if(!requestData.has('logging')){
            savePageNow(req,res);
        } else {
            res.end();
        }
    });

    // patching 
    app.get('/services/complete-page', function (req, res) {
        const requestData = new URLSearchParams(req.query);
        res.render('pages/services-complete-page',{
            requestData: requestData,
        });
    });

    // starts 404 
    app.use(function (req, res, next) {
        res.status(404).render('pages/arquivo-404');
    });
    // ends 404
}