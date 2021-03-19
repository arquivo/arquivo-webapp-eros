const { resolveInclude } = require('ejs');
const express = require('express')

var path = require('path');

const app = express();
const port = 3000;

const i18n = require('i18n-node-yaml')({
  debug: app.get('environment') !== 'production',
  translationFolder: path.join(__dirname, 'translations'),
  locales: ['en_GB', 'pt_PT'],
  defaultLocale: 'pt_PT',
  queryParameters: ['l'],
});

i18n.ready.catch(err => {
  console.error('Failed loading translations', err);
});

app.use(i18n.middleware);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// starts website Routes ////////////////////////////////////////////////////////////////////////////////

// Homepage 
app.use(express.static('./public'));
app.get('/',function (req, res) {

  res.render('pages/home');
});

// Pages search results
app.get('/pages-search-results',function (req, res) {

  res.render('pages/pages-search-results');
});

// Images search results
app.get('/images-search-results',function (req, res) {

  res.render('pages/images-search-results');
});

// Pages: landing page
app.get('/pages',function (req, res) {

  res.render('pages/pages');
});

// Pages advanced search
app.get('/pages-advanced-search',function (req, res) {

  res.render('pages/pages-advanced-search');
});

// Images: landing page
app.get('/images',function (req, res) {

  res.render('pages/images');
});

// Images: advanced search
app.get('/images-advanced-search',function (req, res) {
  res.render('pages/images-advanced-search');
});

// starts Replay
app.get('/replay',function (req, res) {
  res.render('pages/replay');
});
// ends Replay

// starts Replay table results
app.get('/replay-table-list-results',function (req, res) {
  res.render('pages/replay-table-list-results');
});
// ends Replay table results

// starts not found page
app.get('/not-found',function (req, res) {
  res.render('pages/not-found');
});
// ends not found page

// starts not found page
app.get('/search-suggestion',function (req, res) {
  res.render('pages/search-suggestion');
});
// ends not found page

// starts fragments
app.get('/fragments/:id', function(req , res){
  res.render('fragments/' + req.params.id,{layout: false});
});



// ends website Routes ///////////////////////////////////////////////////////

// Open browser port: ${port} 
//////////////////////////////////////////////////////////////////////////////
app.listen(port, () => console.log(`MasterEJS app Started on port ${port}!`));