const makeSearchHandler = require('./search-handler');
const makeExportObject = require('./export-page-search');
const PageSearchApiRequest = require('./apis/page-search-api');

module.exports = makeSearchHandler({
    createApiRequest: (requestData) => new PageSearchApiRequest(requestData.get('api')),
    // The spellchecked query comes in the same reply as the results
    fetchResults: (apiRequest, requestData, next, render) => {
        apiRequest.get(apiRequest.withSpellcheck(requestData),
            (apiData) => render(apiData, apiRequest.getSuggestion(apiData, requestData)));
    },
    itemsKey: 'response_items',
    template: 'partials/pages-search-results',
    makeExportObject: makeExportObject,
    loggerLabel: 'PageSearch',
});
