const logger = require('../logger')('TimestampToText');
const { parseArchiveTimestamp } = require('./archive-timestamp');
function splitTimeStamp(timestamp) {
    if(typeof timestamp != 'string'){
        logger.error(`Expected input to be 'string' but got '${typeof timestamp}': ${timestamp}`)
        timestamp='';
    }
    return parseArchiveTimestamp(timestamp, { pad: true });
}
module.exports = function (translateFunction) {
    let t = translateFunction;
    return {
        short: function (timestamp) {
            const item = splitTimeStamp(timestamp);
            return t('common.date.short', {
                month: t('common.shortMonths.' + item.month),
                day: parseInt(item.day),
            });
        },
        medium: function (timestamp) {
            const item = splitTimeStamp(timestamp);
            return t('common.date.medium', {
                year: item.year,
                month: t('common.months.' + item.month),
                day: parseInt(item.day),
                hours: item.hours,
                minutes: item.minutes,
            });
        },
        long: function (timestamp) {
            const item = splitTimeStamp(timestamp);
            return t('common.date.long', {
                year: item.year,
                month: t('common.months.' + item.month),
                day: parseInt(item.day),
                hours: item.hours,
                minutes: item.minutes,
            });
        }
    }
};