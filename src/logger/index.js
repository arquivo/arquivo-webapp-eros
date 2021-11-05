
const winston = require('winston');
const getDefaults = require('./default.config');

module.exports = (label='-') => winston.createLogger(getDefaults(label));