const logger = require('../logger')('TimestampToText');
function splitTimeStamp(timestamp) {
    const requiredLength = 14;
    if(typeof timestamp != 'string'){
        logger.error(`Expected input to be 'string' but got '${typeof timestamp}': ${timestamp}`)
        timestamp='';
    }
    if (timestamp.length < requiredLength) {
        timestamp = timestamp + '0'.repeat(requiredLength - timestamp.length);
    }
    return {
        year: timestamp.slice(0, 4),
        month: timestamp.slice(4, 6),
        day: timestamp.slice(6, 8),
        hours: timestamp.slice(8, 10),
        minutes: timestamp.slice(10, 12),
        seconds: timestamp.slice(12, 14)
    }


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