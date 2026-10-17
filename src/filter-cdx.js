const { archiveTimestampToDate } = require('./utils/archive-timestamp');
// Legally sensitive: versions younger than this are never listed. Not configurable on purpose;
// if it ever becomes configurable, validate it (minimum 1) and refuse to start on a bad value.
const EMBARGO_YEARS = 1;
// A well-formed 'YYYYMMDDhhmmss' archive timestamp (years 1900-2099); anything else is embargoed
const ARCHIVE_TIMESTAMP = /^(19|20)\d\d(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])([01]\d|2[0-3])[0-5]\d[0-5]\d$/;
// makes export json from Api request and reply
module.exports = function (apiData) {
    const delta = 3600;
    let prevKnown200Index = -1;
    let nextKnown200Index = -1;
    
    const embargoCutoff = embargoCutoffTimestamp();
    const returnData = apiData
        // Sanity check
        .filter((item) => (item.status && item.timestamp && item.digest && item.url))
        // Only 200 and 300 requests are accepted
        .filter(item => (item.status[0] == '2' || item.status[0] == '3'))
        // Filter out redirects to itself
        .filter((item, index, array) => {
            // all with status 200 automatically pass
            if (item.status[0] == '2') {
                prevKnown200Index = index;
                return true;
            }
            // filter out there is a previous item with status 200 within delta timeframe
            if ( prevKnown200Index >= 0 && timestampDifferenceInSeconds(array[prevKnown200Index].timestamp, item.timestamp) <= delta ) {
                return false;
            }
            // find the next item with 200 status 
            if(nextKnown200Index < index){
                nextKnown200Index = index+1;
                while (nextKnown200Index < array.length && array[nextKnown200Index].status[0] != '2'){
                    nextKnown200Index++;
                }
            }
            // filter out if next is 200 within delta timeframe
            if ( nextKnown200Index < array.length && timestampDifferenceInSeconds(array[nextKnown200Index].timestamp, item.timestamp) <= delta ) {
                return false;
            }
            
            return true;
        })
        // Sort by digest to find duplicates
        .sort(sortByDigest)
        // On status 200 duplicates (same digest) on the same day, show only the oldest version
        .filter((item, index, array) => {
            return (index == 0 || item.status[0] != '2' || item.digest != array[index - 1].digest || item.timestamp.substring(0, 8) != array[index - 1].timestamp.substring(0, 8))
        })
        // Embargo: don't display versions younger than EMBARGO_YEARS; fails closed on malformed timestamps
        .filter(item => ARCHIVE_TIMESTAMP.test(item.timestamp) && item.timestamp < embargoCutoff)
        // Sort by timestamp, oldest first (the order the CDX server sends and the views list)
        .sort(sortByTimestamp)

        ;

    return returnData;
}

// 'YYYYMMDDhhmmss' (UTC, like archive timestamps) of EMBARGO_YEARS ago, compared as a string
function embargoCutoffTimestamp() {
    const cutoff = new Date();
    const month = cutoff.getUTCMonth();
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - EMBARGO_YEARS);
    // On 29 Feb the year before has no such day and Date rolls over to 1 Mar; clamp to 28 Feb
    if (cutoff.getUTCMonth() !== month) {
        cutoff.setUTCDate(0);
    }
    return cutoff.toISOString().replace(/\D/g, '').substring(0, 14);
}

function compare(a, b) {
    return (a > b) - (a < b);
}

// Sorts items by digest. If digest is the same, sorts them by timestamp.
function sortByDigest(item1, item2) {
    return compare(item1.digest, item2.digest) || sortByTimestamp(item1, item2);
}

function sortByTimestamp(item1, item2) {
    return compare(item1.timestamp, item2.timestamp);
}

function timestampDifferenceInSeconds(ts1, ts2) {
    return Math.abs(archiveTimestampToDate(ts2) - archiveTimestampToDate(ts1)) / 1000;
}