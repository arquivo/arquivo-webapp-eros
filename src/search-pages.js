const sanitizeInputs = require('./sanitize-search-params');
const makeExportObject = require('./export-object')    
const suggestionRequest = require('./apis/suggestion-api')
const PageSearchApiRequest = require('./apis/page-search-api')

module.exports = function (req, res) {
    const requestData = sanitizeInputs(req, res);
    const apiRequest = new PageSearchApiRequest();

    suggestionRequest(requestData.get('q'), requestData.get('l') ?? 'pt',
        (suggestion) => {
            apiRequest.get(requestData,
                (apiData) => {
                    res.render('partials/pages-search-results', {
                        requestData: requestData,
                        apiData: apiData,
                        suggestion: suggestion,
                        exportObject: makeExportObject(req, res, apiRequest.sanitizeRequestData(requestData), apiData)
                    });
                })
        });
}
