const { resolveInclude } = require('ejs');
const express = require('express');
const config = require('config');
const session = require('express-session');
const cookies = require("cookie-parser");
const path = require('path');
const router = require('./src/router');
const trafficLogger = require('./src/logger/traffic-logger');

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
  require('./src/logger')('Server').error('Failed loading translations', err);
});

// use session middleware
app.use(session({
    secret: config.get('session.secret'),
    saveUninitialized:true,
    cookie: { maxAge: config.get('session.length') },
    resave: false 
}));
app.use((req,res,next) => {
  res.locals.session = req.session;
  next();
})

app.use(cookies());

// const morgan = require('morgan')
// app.use(morgan('combined'))

app.use((req,res,next) => {
  // clear language headers to prevent auto-detect browser language
  let requestLanguage = '';
  if(req.headers && req.headers['accept-language']){
    requestLanguage = req.headers['accept-language'];
    req.headers['accept-language'] = null;
  }
  let oldL = null;
  if(req.url.startsWith('/wayback') && !!req.query  && !!req.query.l){
    oldL = req.query.l;
    const locale = (req.cookies ? req.cookies.i18n : null) || 'pt_PT';
    req.query.l = locale.split('_').shift();
  }
  i18n.middleware(req,res,() => {});
  if(req.headers && req.headers['accept-language'] === null){
    req.headers['accept-language'] = requestLanguage;
  }
  if(!!oldL){
    req.query.l = oldL;
  }
  next();
});
app.locals.config = config;

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static('./public'));

// starts website Routes ////////////////////////////////////////////////////////////////////////////////
app.use(express.json()) // for parsing application/json
app.use(express.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded



// Use utils
const utils = require('./src/utils/utils-middleware');
app.use(utils);

app.use(trafficLogger);

app.use((req,res,next) => {
  res.locals.originalUrl = req.url;
  next();
})

app.use(router);
// ends website Routes ///////////////////////////////////////////////////////

// Open browser port: ${port} 
//////////////////////////////////////////////////////////////////////////////
app.listen(port, () => console.log(`Arquivo.pt webapp started on port ${port}!`));