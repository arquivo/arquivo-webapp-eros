const sanitizeInputs = require('./utils/sanitize-search-params');
const makeExportObject = require('./export-page-search');
const PageSearchApiRequest = require('./apis/page-search-api');
const logger = require('./logger')('PageSearch');

module.exports = function (req, res) {
    const requestData = sanitizeInputs(req, res);
    const apiRequest = new PageSearchApiRequest(requestData.get('api'));

    // The spellchecked query comes in the same reply as the results
    apiRequest.get(apiRequest.withSpellcheck(requestData),
        (apiData) => {
            if(!apiData.response_items || apiData.response_items.length == 0){
                logger.info('No results found for the following query: '+JSON.stringify(requestData.get('q')));
            }
            res.render('partials/pages-search-results', {
                requestData: requestData,
                apiData: apiData,
                suggestion: apiRequest.getSuggestion(apiData, requestData),
                exportObject: makeExportObject(apiRequest.sanitizeRequestData(requestData), apiData, req.t)
            });
        });
}
