const searchPages = require('./search-pages.js');

module.exports = function (app) {
    // Homepage 
    app.get('/', function (req, res) {

        res.render('pages/home');
    });

    // Pages search results
    app.get('/pages-search-results', function (req, res) {
        searchPages(req,res);
    });

    // Images search results
    app.get('/images-search-results', function (req, res) {

        res.render('pages/images-search-results');
    });

    // Pages: landing page
    app.get('/pages', function (req, res) {

        res.render('pages/pages');
    });

    // Pages advanced search
    app.get('/pages-advanced-search', function (req, res) {

        res.render('pages/pages-advanced-search');
    });

    // Images: landing page
    app.get('/images', function (req, res) {

        res.render('pages/images');
    });

    // Images: advanced search
    app.get('/images-advanced-search', function (req, res) {
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

    // starts 404 
    app.get('/arquivo-404', function (req, res) {
        res.render('pages/arquivo-404');
    });
    // ends 404

    // starts fragments
    app.get('/fragments/:id', function (req, res) {
        res.render('fragments/' + req.params.id, { layout: false });
    });

    // starts preloader
    app.get('/fragments/preloader', function (req, res) {
        res.render('fragments/preloader' + req.params.id, { layout: false });
    });
}