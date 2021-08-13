const { resolveInclude } = require('ejs');
const express = require('express');
const config = require('config');

var path = require('path');
var morgan = require('morgan')

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

//app.use(morgan('combined'))

app.use(i18n.middleware);
app.locals.config = config;

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static('./public'));

// starts website Routes ////////////////////////////////////////////////////////////////////////////////
app.use(express.json()) // for parsing application/json
app.use(express.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded
require('./src/router')(app);

// ends website Routes ///////////////////////////////////////////////////////

// Open browser port: ${port} 
//////////////////////////////////////////////////////////////////////////////
app.listen(port, () => console.log(`MasterEJS app Started on port ${port}!`));