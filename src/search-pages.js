const makeSearchHandler = require('./search-handler');
const makeExportObject = require('./export-page-search');
const PageSearchApiRequest = require('./apis/page-search-api');

module.exports = makeSearchHandler({
    createApiRequest: (requestData) => new PageSearchApiRequest(requestData.get('api')),
    // The spellchecked query comes in the same reply as the results.
    // Known gap: unlike the images search, there is no .catch/next here. A throw inside the API
    // callback (e.g. in getSuggestion or makeExportObject) is swallowed by api-request.js, logged as
    // a misleading "JSON parse error", and the request hangs. Fixing it needs router.js to pass
    // next to this handler, so that render errors can be routed with next(err).
    fetchResults: (apiRequest, requestData, next, render) => {
        apiRequest.get(apiRequest.withSpellcheck(requestData),
            (apiData) => render(apiData, apiRequest.getSuggestion(apiData, requestData)));
    },
    itemsKey: 'response_items',
    template: 'partials/pages-search-results',
    makeExportObject: makeExportObject,
    loggerLabel: 'PageSearch',
});
