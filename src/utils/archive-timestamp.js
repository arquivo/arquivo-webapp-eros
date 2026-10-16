/**
 * Archive Timestamp Utility
 *
 * Single parser for the 14-char 'YYYYMMDDhhmmss' archive timestamps.
 */
const TIMESTAMP_LENGTH = 14;

/**
 * Splits a timestamp into its string parts (e.g. month '03', not 3).
 *
 * @param {string} timestamp - 'YYYYMMDDhhmmss', characters beyond the 14th are ignored
 * @param {Object} [options]
 * @param {boolean} [options.pad=false] - right-pad a partial timestamp with '0'.
 *   When false, the missing parts are empty strings.
 * @returns {{year: string, month: string, day: string, hours: string, minutes: string, seconds: string}}
 */
function parseArchiveTimestamp(timestamp, { pad = false } = {}) {
    if (pad) {
        timestamp = timestamp.padEnd(TIMESTAMP_LENGTH, '0');
    }
    return {
        year: timestamp.substring(0, 4),
        month: timestamp.substring(4, 6),
        day: timestamp.substring(6, 8),
        hours: timestamp.substring(8, 10),
        minutes: timestamp.substring(10, 12),
        seconds: timestamp.substring(12, 14)
    };
}

/**
 * Converts a timestamp to a Date in the server's local timezone.
 * A partial timestamp is not padded, so it gives an Invalid Date.
 *
 * @param {string} timestamp - 'YYYYMMDDhhmmss'
 * @returns {Date}
 */
function archiveTimestampToDate(timestamp) {
    const parts = parseArchiveTimestamp(timestamp);
    return new Date(
        parseInt(parts.year),
        parseInt(parts.month) - 1, // Date months are 0-based
        parseInt(parts.day),
        parseInt(parts.hours),
        parseInt(parts.minutes),
        parseInt(parts.seconds)
    );
}

module.exports = { parseArchiveTimestamp, archiveTimestampToDate };
