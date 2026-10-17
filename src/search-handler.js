const sanitizeInputs = require('./utils/sanitize-search-params');
const makeLogger = require('./logger');

/**
 * Makes the handler of a search results partial (pages or images): sanitizes the request,
 * gets the results and the spelling suggestion, logs searches without results and renders
 * the partial with its export object.
 *
 * @param {Object} search - What differs between the searches
 * @param {Function} search.createApiRequest - (requestData) => API request for the results
 * @param {Function} search.fetchResults - (apiRequest, requestData, next, render) => gets the
 *     results and the suggestion and calls render(apiData, suggestion)
 * @param {string} search.itemsKey - Key of the result items in the API reply
 * @param {string} search.template - Partial to render
 * @param {Function} search.makeExportObject - Builds the export object of the results
 * @param {string} search.loggerLabel - Label of the logged messages
 * @returns {Function} Express handler(req, res, next)
 */
module.exports = function makeSearchHandler({ createApiRequest, fetchResults, itemsKey, template, makeExportObject, loggerLabel }) {
    const logger = makeLogger(loggerLabel);

    return function searchHandler(req, res, next) {
        const requestData = sanitizeInputs(req, res);
        const apiRequest = createApiRequest(requestData);

        // fetchResults routes the errors of getting the results and of rendering them to next
        fetchResults(apiRequest, requestData, next, (apiData, suggestion) => {
            if(!apiData[itemsKey] || apiData[itemsKey].length == 0){
                logger.info('No results found for the following query: '+JSON.stringify(requestData.get('q')));
            }
            res.render(template, {
                requestData: requestData,
                apiData: apiData,
                suggestion: suggestion,
                exportObject: makeExportObject(apiRequest.sanitizeRequestData(requestData), apiData, req.t)
            });
        });
    };
}
