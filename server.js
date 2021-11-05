const { resolveInclude } = require('ejs');
const express = require('express');
const config = require('config');
const session = require('express-session');
const cookies = require("cookie-parser");
const path = require('path');

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

app.use(i18n.middleware);
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

require('./src/router')(app);

// ends website Routes ///////////////////////////////////////////////////////

// Open browser port: ${port} 
//////////////////////////////////////////////////////////////////////////////
app.listen(port, () => console.log(`MasterEJS app Started on port ${port}!`));