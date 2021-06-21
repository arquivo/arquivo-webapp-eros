const searchPages = require('./search-pages.js');
const searchImages = require('./search-images.js');
const searchUrl = require('./search-url.js');
const sanitizeInputs = require('./sanitize-search-params');

module.exports = function (app) {
    // Homepage 
    app.get('/', function (req, res) {

        res.render('pages/home');
    });

    // Pages search results
    app.get('/page/search', function (req, res) {
        const requestData = sanitizeInputs(req, res);
        const urlPattern = /^\s*((https?:\/\/)?([a-zA-Z\d][-\w\.]+)\.([a-zA-Z\.]{2,6})([-\/\w\p{L}\.~,;:%&=?+$#*\(?\)?]*)*\/?)\s*$/

        if (!requestData.has('q') || requestData.get('q') == '') {
            res.render('pages/home');
        } else if(urlPattern.test(requestData.get('q'))){
            res.redirect('/url/search?'+requestData.toString())
        } else {
            res.render('pages/pages-search-results', {
                requestData: requestData,
            });
        }
    });
    app.get('/url/search', function (req, res) {
        res.render('pages/replay-table-list-results', {requestData: sanitizeInputs(req, res) });
    });

    // Images search results
    app.get('/images-search-results', function (req, res) {

        res.render('pages/images-search-results');
    });// Images search results
    // Images search results
    app.get('/image/search', function (req, res) {
        const requestData = sanitizeInputs(req, res);
        const urlPattern = /^\s*((https?:\/\/)?([a-zA-Z\d][-\w\.]+)\.([a-zA-Z\.]{2,6})([-\/\w\p{L}\.~,;:%&=?+$#*\(?\)?]*)*\/?)\s*$/

        if (!requestData.has('q') || requestData.get('q') == '') {
            res.render('pages/home');
        } else {
            if(urlPattern.test(requestData.get('q'))){
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
        
        const requestData = sanitizeInputs(req, res);
        res.render('pages/pages-advanced-search',{requestData:requestData});
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


    // starts Replay
    app.get('/replay', function (req, res) {
        res.render('pages/replay');
    });
    // ends Replay


    // starts not found page
    app.get('/not-found', function (req, res) {
        res.render('pages/not-found');
    });
    // ends not found page

    // starts not found page
    app.get('/search-suggestion', function (req, res) {
        res.render('pages/search-suggestion');
    });
    // ends not found page

    // starts show table 
    app.get('/replay-table-results', function (req, res) {
        res.render('pages/replay-table-results');
    });
    // ends show table

    // starts show list 
    app.get('/replay-list-results', function (req, res) {
        res.render('pages/replay-list-results');
    });
    // ends show list    

    // starts partials
    app.get('/partials/:id', function (req, res) {
        if (req.params.id == 'pages-search-results') {
            searchPages(req, res);
        } else if(req.params.id == 'images-search-results') {
            searchImages(req, res);
        } else if(req.params.id == 'url-search-results') {
            searchUrl(req, res);
        }else {
            res.render('partials/' + req.params.id, { layout: false });
        }
    });

    // starts 404 
    app.use(function (req, res, next) {
        res.status(404).render('pages/arquivo-404');
    });
    // ends 404
}