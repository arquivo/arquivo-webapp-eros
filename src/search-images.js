const sanitizeInputs = require('./sanitize-search-params');
const SuggestionApi = require('./apis/suggestion-api');
const ImageSearchApiRequest = require('./apis/image-search-api');
const makeExportObject = require('./export-image-search');

module.exports = function (req, res) {
    
    const requestData = sanitizeInputs(req, res);
    const apiRequest = new ImageSearchApiRequest(); 
    const suggestionRequest = new SuggestionApi();

    suggestionRequest.getSuggestion(requestData.get('q'), requestData.get('l') ?? 'pt',
        (suggestion) => {
            apiRequest.get(requestData,
                (apiData) => {
                    res.render('partials/images-search-results', {
                        requestData: requestData,
                        apiData: apiData,
                        suggestion: suggestion,
                        exportObject: makeExportObject(apiRequest.sanitizeRequestData(requestData), apiData, req.t)
                    });
                })
        });
}
