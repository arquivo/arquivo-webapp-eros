'use strict';

const makeSearchHandler = require('./search-handler');
const PageSearchApiRequest = require('./apis/page-search-api');
const ImageSearchApiRequest = require('./apis/image-search-api');
const makeExportObject = require('./export-image-search');

// Suggestions are not critical, so don't hold the image results back for long waiting for one
const SUGGESTION_TIMEOUT = 3000;

module.exports = makeSearchHandler({
    createApiRequest: () => new ImageSearchApiRequest(),
    // The image search API doesn't spellcheck, so the suggestion comes from the page search API, in parallel
    fetchResults: (apiRequest, requestData, next, render) => {
        const suggestionRequest = new PageSearchApiRequest({ timeout: SUGGESTION_TIMEOUT });

        Promise.all([
            new Promise((resolve) => suggestionRequest.suggest(requestData, resolve)),
            new Promise((resolve) => apiRequest.get(requestData, resolve)),
        ]).then(([suggestion, apiData]) => render(apiData, suggestion)).catch(next);
    },
    itemsKey: 'responseItems',
    template: 'partials/images-search-results',
    makeExportObject: makeExportObject,
    loggerLabel: 'ImageSearch',
});
