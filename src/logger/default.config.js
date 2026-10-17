'use strict';

const winston = require('winston');
const nodePath = require('node:path');
const config = require('config');
require('winston-daily-rotate-file');

const loggerType = config.get('logger.type');

let transports = [];

if(loggerType == 'daily'){
    transports.push(new winston.transports.DailyRotateFile({
        dirname: config.get('logger.dir'),
        filename: 'arquivo-webapp.log.%DATE%',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: false,
        maxSize: '100m',
        // Retention: older files are deleted (e.g. '30d': 30 days, '10': 10 files)
        maxFiles: config.get('logger.maxFiles'),
        // Where the files are listed for the retention. Its default name is a hash of
        // these options, so a new retention setting would start a new list and never
        // delete the files of the old one.
        auditFile: nodePath.join(config.get('logger.dir'), '.arquivo-webapp-audit.json'),
      }));
} else if(loggerType == 'file'){
    transports.push(new winston.transports.File({ filename: config.get('logger.dir')+'arquivo-webapp.log' }));
} else { //assume console
    transports.push(new winston.transports.Console());
}

module.exports = (label='-') => ({
    transports: transports,
    format: winston.format.combine(
        winston.format.timestamp({format:'DD/MMM/YYYY:HH:mm:ss'}),
        winston.format.printf(info => {
          return `${info.timestamp}\t${info.level.toUpperCase()}\t${label}\t-\t${info.stack  || info.message}`;
        }),
        winston.format.splat()
    ),
  })