const winston = require('winston');
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