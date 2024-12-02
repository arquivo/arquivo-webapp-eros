const sanitizeInputs = require('./utils/sanitize-search-params');
const makeExportObject = require('./export-page-search');
const SuggestionApi = require('./apis/suggestion-api');
const PageSearchApiRequest = require('./apis/page-search-api');
const logger = require('./logger')('PageSearch');

module.exports = function (req, res) {
    const requestData = sanitizeInputs(req, res);
    const apiRequest = new PageSearchApiRequest(requestData.get('api'));
    const suggestionRequest = new SuggestionApi();

    // Turn off deduplication when titleSearch:
    if(requestData.has('titleSearch')){
        requestData.set('dedupValue',-1);
    }

    suggestionRequest.getSuggestion(requestData.get('q'), requestData.get('l') ?? 'pt',
        (suggestion) => {
            apiRequest.get(requestData,
                (apiData) => {
                    if(!apiData.response_items || apiData.response_items.length == 0){
                        logger.info('No results found for the following query: '+JSON.stringify(requestData.get('q')));
                    }
                    res.render('partials/pages-search-results', {
                        requestData: requestData,
                        apiData: apiData,
                        suggestion: suggestion,
                        exportObject: makeExportObject(apiRequest.sanitizeRequestData(requestData), apiData, req.t)
                    });
                })
        });
}
