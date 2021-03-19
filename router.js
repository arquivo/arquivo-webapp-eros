module.exports = function (app) {
    // Homepage 
    app.get('/', function (req, res) {

        res.render('pages/home');
    });

    // Pages search results
    app.get('/pages-search-results', function (req, res) {

        res.render('pages/pages-search-results');
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

    // starts Replay table results
    app.get('/replay-table-list-results', function (req, res) {
        res.render('pages/replay-table-list-results');
    });
    // ends Replay table results

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


    // starts fragments
    app.get('/fragments/:id', function (req, res) {
        res.render('fragments/' + req.params.id, { layout: false });
    });
}