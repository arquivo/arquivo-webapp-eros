'use strict';

const sanitizeInputs = require('./utils/sanitize-search-params');
const CDXSearchApiRequest = require('./apis/cdx-api')
const cdxFilter = require('./filter-cdx')
const SuggestionApi = require('./apis/suggestion-api')
const logger = require('./logger')('UrlSearch');

module.exports = function (req, res) {
    const requestData = sanitizeInputs(req, res);
    const viewModeDefault = 'list'

    let viewMode = requestData.get('viewMode') ?? viewModeDefault;

    if (!(['table', 'list'].includes(viewMode))) {
        viewMode = viewModeDefault;
    }
    if (viewMode != viewModeDefault) {
        requestData.set('viewMode', viewModeDefault);
    }
    const apiRequest = new CDXSearchApiRequest();
    const suggestionRequest = new SuggestionApi();

    suggestionRequest.getSuggestion(requestData.get('q'), requestData.get('l') ?? 'pt',
        (suggestion) => {
            apiRequest.get(requestData,
                (apiData) => {
                    if(apiData.length == 0) {
                        // Only the length: the query itself may hold personal data
                        logger.info('No results found for a query of ' + (requestData.get('q') ?? '').length + ' characters');
                    }
                    res.render('partials/url-' + viewMode + '-results', {
                        requestData: requestData,
                        apiData: cdxFilter(apiData),
                        suggestion: suggestion,
                    });
                });
        });
}

