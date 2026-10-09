const sanitizeInputs = require('./utils/sanitize-search-params');
const PageSearchApiRequest = require('./apis/page-search-api');
const ImageSearchApiRequest = require('./apis/image-search-api');
const makeExportObject = require('./export-image-search');
const logger = require('./logger')('ImageSearch');

// Suggestions are not critical, so don't hold the image results back for long waiting for one
const SUGGESTION_TIMEOUT = 3000;

module.exports = function (req, res, next) {
    
    const requestData = sanitizeInputs(req, res);
    const apiRequest = new ImageSearchApiRequest(); 
    // The image search API doesn't spellcheck, so the suggestion comes from the page search API, in parallel
    const suggestionRequest = new PageSearchApiRequest(null, { timeout: SUGGESTION_TIMEOUT });

    Promise.all([
        new Promise((resolve) => suggestionRequest.suggest(requestData, resolve)),
        new Promise((resolve) => apiRequest.get(requestData, resolve)),
    ]).then(([suggestion, apiData]) => {
        if(!apiData.responseItems || apiData.responseItems.length == 0){
            logger.info('No results found for the following query: '+JSON.stringify(requestData.get('q')));
        }
        res.render('partials/images-search-results', {
            requestData: requestData,
            apiData: apiData,
            suggestion: suggestion,
            exportObject: makeExportObject(apiRequest.sanitizeRequestData(requestData), apiData, req.t)
        });
    }).catch(next);
}
