// makes export json from Api request and reply
module.exports = function (apiData) {
    const delta = 3600;
    const returnData = apiData
        // Sanity check
        .filter((item) => (item.status && item.timestamp && item.digest && item.url))
        // Only 200 and 300 requests are accepted
        .filter(item => (item.status[0] == '2' || item.status[0] == '3'))
        // Sort by digest to find duplicates
        .sort(sortByDigest)
        // On duplicates (same digest) show only the oldest version
        .filter((item, index, array) => {
            return (index == 0 || item.digest != array[index - 1].digest)
        })
        // Sort by timestamp to properly order the results
        .sort(sortByTimestamp)
        .filter((item, index, array) => {
            // all with status 200 automatically pass
            if (item.status[0] == '2') {
                return true;
            }
            // filter out if previous is 200 within delta timeframe
            if (
                index > 0 && // make sure there's a previous index
                array[index - 1].status[0] == '2' && timestampDifferenceInSeconds(array[index - 1].timestamp, item.timestamp) <= delta // actual condition
            ) {
                return false;
            }
            // filter out if next is 200 within delta timeframe
            if (
                index < array.length - 1 && // make sure there's a next index
                array[index + 1].status[0] == '2' && timestampDifferenceInSeconds(item.timestamp, array[index + 1].timestamp) <= delta // actual condition
            ) {
                return false;
            }
            return true;
        })
        ;

    console.log(returnData.length);
    apiData.filter(x => !x.status).forEach(item => {
        console.log(item);
    });
    console.log(returnData.filter(x => x.status[0] == '2').length);
    return returnData;
}
// Sorts items by digest. If digest is the same, sorts them by timestamp.
function sortByDigest(item1, item2) {
    if (item1.digest != item2.digest) {
        return (item2.digest > item1.digest) ? 1 : 0;
    } else {
        return sortByTimestamp(item1, item2);
    }
}

function sortByTimestamp(item1, item2) {
    return (item2.timestamp > item1.timestamp) ? 1 : 0;
}

function getDateFromTimestamp(ts) {
    let y = parseInt(ts.substring(0, 4));
    let M = parseInt(ts.substring(4, 6)) - 1;
    let d = parseInt(ts.substring(6, 8));
    let h = parseInt(ts.substring(8, 10));
    let m = parseInt(ts.substring(10, 12));
    let s = parseInt(ts.substring(12, 14));
    return new Date(y, M, d, h, m, s);
}
function timestampDifferenceInSeconds(ts1, ts2) {
    let tsd1 = getDateFromTimestamp(ts1);
    let tsd2 = getDateFromTimestamp(ts2);
    return (tsd2.getTime() - tsd1.getTime()) / 1000;
}
