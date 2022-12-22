const sanitizeInputs = require('./utils/sanitize-search-params');
const SuggestionApi = require('./apis/suggestion-api');
const ImageSearchApiRequest = require('./apis/image-search-api');
const makeExportObject = require('./export-image-search');
const logger = require('./logger')('ImageSearch');

module.exports = function (req, res) {
    
    const requestData = sanitizeInputs(req, res);
    const apiRequest = new ImageSearchApiRequest(); 
    const suggestionRequest = new SuggestionApi();

    suggestionRequest.getSuggestion(requestData.get('q'), requestData.get('l') ?? 'pt',
        (suggestion) => {
            apiRequest.get(requestData,
                (apiData) => {
                    if(!apiData.responseItems || apiData.responseItems.length == 0){
                        logger.info('No results found for the following query: '+JSON.stringify(requestData.get('q')));
                    }
                    res.render('partials/images-search-results', {
                        requestData: requestData,
                        apiData: apiData,
                        suggestion: suggestion,
                        exportObject: makeExportObject(apiRequest.sanitizeRequestData(requestData), apiData, req.t)
                    });
                })
        });
}
