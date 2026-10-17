// The given date (now by default) as YYYY-MM-DD, in the server's local time zone.
module.exports = function localIsoDate(date = new Date()) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('-');
};
