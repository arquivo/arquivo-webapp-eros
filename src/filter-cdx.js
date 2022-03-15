// makes export json from Api request and reply
module.exports = function (apiData) {
    const delta = 3600;
    let prevKnown200Index = -1;
    let nextKnown200Index = -1;
    
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
            return (index == 0 || item.status[0] != '2' || item.digest != array[index - 1].digest || item.timestamp.substring(6, 8) != array[index - 1].timestamp.substring(6, 8))
        })
        // Sort by timestamp to properly order the results
        .sort(sortByTimestamp)
        ;

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
    return Math.abs((tsd2.getTime() - tsd1.getTime()) / 1000);
}