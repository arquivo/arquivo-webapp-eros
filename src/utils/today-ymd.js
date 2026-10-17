const localIsoDate = require('./local-iso-date');

// The given date (today by default) as YYYYMMDD, in local time
module.exports = function (date = new Date()) {
    return localIsoDate(date).replaceAll('-', '');
};
