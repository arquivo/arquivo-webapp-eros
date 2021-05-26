//makes export json from Api request and reply
module.exports = function (apiData) {                
    return apiData
        //Only 200 and 300 requests are accepted
        .filter(item => (item.status && (item.status[0] == '2' || item.status[0] == '3')))
        //Sort by digest to find duplicates
        .sort(sortByDigest)
        //On duplicates (same digest) show only the oldest version
        .filter((item,index,array) => {
            return (index == 0 || item.digest != array[index-1].digest) 
        })
        //Sort by timestamp to properly order the results
        .sort(sortByTimestamp);
}

function sortByDigest(item1,item2) {
    if(item1.digest != item2.digest){
        return (item2.digest > item1.digest) ? 1 : 0;
    } else {
        return sortByTimestamp(item1,item2);
    }
}
function sortByTimestamp(item1,item2){
    return (item2.timestamp > item1.timestamp) ? 1 : 0;
}
