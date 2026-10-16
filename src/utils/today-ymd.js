// The given date (today by default) as YYYYMMDD, in local time
module.exports = function (date = new Date()) {
    return date.toLocaleDateString('en-CA').split('-').join('');
};
