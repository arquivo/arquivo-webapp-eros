
const PageSearchApiRequest = require('./apis/page-search-api');
const cdxFilter = require('./filter-cdx')

module.exports = function (req, res) {
    const requestData = req.utils.sanitizeInputs(req, res);

    //Api request for technical details.
    const apiRequest = new PageSearchApiRequest();
    const apiRequestData = new URLSearchParams({
        metadata: requestData.get('url') + '/' + requestData.get('timestamp')
    })

    apiRequest.get(apiRequestData,
        (apiData) => {
            const data = apiData.response_items ? apiData.response_items[0] : {};
            requestData.set('l',req.getLanguage());
            res.render('partials/replay-technical-details', {
                requestData,
                apiData: data
            });
        });
}

