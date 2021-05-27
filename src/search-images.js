const sanitizeInputs = require('./sanitize-search-params');
const suggestionRequest = require('./apis/suggestion-api')
const ImageSearchApiRequest = require('./apis/image-search-api');

module.exports = function (req, res) {
    
    const requestData = sanitizeInputs(req, res);
    const apiRequest = new ImageSearchApiRequest(); 

    suggestionRequest(requestData.get('q'), requestData.get('l') ?? 'pt',
        (suggestion) => {
            apiRequest.get(requestData,
                (apiData) => {
                    res.render('partials/images-search-results', {
                        requestData: requestData,
                        apiData: apiData,
                        suggestion: suggestion,
                        // exportObject: makeExportObject(req, res, apiRequestData, apiData)
                    });
                })
        });
}
