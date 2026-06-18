
const winston = require('winston');
const getDefaults = require('./default.config');

const createLogger = (label='-') => winston.createLogger(getDefaults(label));
module.exports = createLogger;