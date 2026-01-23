const sanitizeInputs = require('./utils/sanitize-search-params');
const CDXSearchApiRequest = require('./apis/cdx-api')
const cdxFilter = require('./filter-cdx')

/**
 * Replay navigation handler
 * 
 * Fetches CDX data for a given URL and renders the replay navigation partial.
 * This is used to display the timeline/calendar navigation for archived pages.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
module.exports = function (req, res) {
    const requestData = sanitizeInputs(req, res);
    const apiRequest = new CDXSearchApiRequest();

    const cdxRequestData = new URLSearchParams({
        url: requestData.get('url')
    });

    apiRequest.get(cdxRequestData, (apiData) => {
        res.render('partials/replay-nav', {
            requestData: requestData,
            apiData: cdxFilter(apiData),
        });
    });
}

