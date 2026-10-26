'use strict';

const makeSearchHandler = require('./search-handler');
const makeExportObject = require('./export-page-search');
const PageSearchApiRequest = require('./apis/page-search-api');

module.exports = makeSearchHandler({
    createApiRequest: () => new PageSearchApiRequest(),
    // The spellchecked query comes in the same reply as the results.
    // Errors thrown in the API callback (e.g. by getSuggestion or makeExportObject) are routed to
    // next, like the images search does: left uncaught, the API client would swallow them (and the
    // request would hang) or, on its error paths, crash the process.
    fetchResults: (apiRequest, requestData, next, render) => {
        apiRequest.get(apiRequest.withSpellcheck(requestData), (apiData) => {
            try {
                render(apiData, apiRequest.getSuggestion(apiData, requestData));
            } catch (err) {
                next(err);
            }
        });
    },
    itemsKey: 'response_items',
    template: 'partials/pages-search-results',
    makeExportObject: makeExportObject,
    loggerLabel: 'PageSearch',
});
