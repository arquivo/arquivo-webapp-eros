const sanitizeInputs = require('./utils/sanitize-search-params');
const CDXSearchApiRequest = require('./apis/cdx-api')
const cdxFilter = require('./filter-cdx')

module.exports = function (req, res) {
    const requestData = sanitizeInputs(req, res);
    const apiRequest = new CDXSearchApiRequest();

    apiRequest.get({ url: requestData.get('url') },
        (apiData) => {
            res.render('partials/replay-nav', {
                requestData: requestData,
                apiData: cdxFilter(apiData),
            });
        });
}

