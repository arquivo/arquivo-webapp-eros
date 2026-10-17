/** Splits a 'YYYYMMDDhhmmss' archive timestamp into string parts (month '03'); a partial one is not padded. */
function parseArchiveTimestamp(timestamp) {
    const part = (start, end) => timestamp.substring(start, end);
    return { year: part(0, 4), month: part(4, 6), day: part(6, 8),
        hours: part(8, 10), minutes: part(10, 12), seconds: part(12, 14) };
}

/**
 * Local time Date. A timestamp shorter than 13 characters gives an Invalid Date; a 13-character
 * one is valid, with the seconds read from its last digit. Does not validate its input
 * (lenient parseInt, Date rollover), so never feed it user input for access decisions.
 */
function archiveTimestampToDate(timestamp) {
    const { year, month, day, hours, minutes, seconds } = parseArchiveTimestamp(timestamp);
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes), parseInt(seconds));
}

module.exports = { parseArchiveTimestamp, archiveTimestampToDate };
