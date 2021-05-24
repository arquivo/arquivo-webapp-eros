const config = require('config');
const sanitizeInputs = require('./sanitize-search-params');
const apiRequest = require('./apis/cdx-api')


const now = new Date();

module.exports = function (req, res) {
    const requestData = sanitizeInputs(req, res);
    const defaultApiParams = {
        output: 'json',
        from: config.get('search.start.date'),
        url: requestData.get('q'),
        to: now.toLocaleDateString('en-CA').split('-').join(''),
        filter: '!~status:4|5',
        fields: 'url,timestamp,status'
    }
    const apiRequestData = new URLSearchParams();

    const viewModeDefault = 'list'
    let viewMode = requestData.get('viewMode') ?? viewModeDefault;

    if (!(['table', 'list'].includes(viewMode))) {
        viewMode = viewModeDefault;
    }
    if (viewMode != viewModeDefault) {
        requestData.set('viewMode', viewModeDefault);
    }

    //Load parameters onto api request data
    Object.keys(defaultApiParams)
        .filter(key => defaultApiParams[key] !== null || requestData.has(key))
        .forEach(key => apiRequestData.set(key, requestData.get(key) ?? defaultApiParams[key]));


    apiRequest(apiRequestData,
        (apiData) => {
            let intermediateData = [];
            let previousItem = null;

            const deltaToRemoveDuplicatedEntries = 3600;
            apiData.forEach(item => {
                if (item.status && (item.status[0] !== '2' && item.status[0] !== '3')) { /*Ignore 400's and 500's*/
                    /*empty on purpose*/
                } else {
                    if (previousItem != null && isRemovePreviousVersion(previousItem, item, deltaToRemoveDuplicatedEntries)) {
                        intermediateData.pop();
                    }
                    if (previousItem == null || !isRemoveCurrentVersion(previousItem, item, deltaToRemoveDuplicatedEntries)) {
                        intermediateData.push(item);
                        previousItem = item;
                    }
                }
            })

            

            res.render('partials/url-' + viewMode + '-results', {
                requestData: requestData,
                apiData: intermediateData,
                // suggestion: suggestion,
            });
        });


    //Helper functions for purging items from the api data
    function isRemovePreviousVersion(previousVersion, currentVersion, delta) {
        return previousVersion.status && currentVersion.status && previousVersion.status[0] === '3' && currentVersion.status[0] === '2' && timestampDifferenceInSeconds(previousVersion.timestamp, currentVersion.timestamp) <= delta;
    }

    function isRemoveCurrentVersion(previousVersion, currentVersion, delta) {
        return previousVersion.status && currentVersion.status && previousVersion.status[0] === '2' && currentVersion.status[0] === '3' && timestampDifferenceInSeconds(previousVersion.timestamp, currentVersion.timestamp) <= delta;
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
}

