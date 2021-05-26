const config = require('config');
const sanitizeInputs = require('./sanitize-search-params');
const apiRequest = require('./apis/cdx-api')
const cdxFilter  = require('./filter-cdx')
const suggestionRequest = require('./apis/suggestion-api')


const now = new Date();

module.exports = function (req, res) {
    const requestData = sanitizeInputs(req, res);
    const defaultApiParams = {
        output: 'json',
        from: config.get('search.start.date'),
        url: requestData.get('q'),
        to: now.toLocaleDateString('en-CA').split('-').join(''),
        filter: '!:~status:4|5',
        fields: 'url,timestamp,status,digest'
    }
    const apiRequestData = new URLSearchParams();

    const viewModeDefault = 'list'
    let viewMode = requestData.get('viewMode') ?? viewModeDefault;

    if (!(['table', 'list'].includes(viewMode))) {
        viewMode = viewModeDefault;
    }
    if (viewMode != viewModeDefault) {
        requestData.set('viewMode', viewModeDefault);
    }

    //Load parameters onto api request data
    Object.keys(defaultApiParams)
        .filter(key => defaultApiParams[key] !== null || requestData.has(key))
        .forEach(key => apiRequestData.set(key, requestData.get(key) ?? defaultApiParams[key]));


    suggestionRequest(requestData.get('q'), apiRequestData.get('l') ?? 'pt',
        (suggestion) => {
            apiRequest(apiRequestData,
                (apiData) => {
                    res.render('partials/url-' + viewMode + '-results', {
                        requestData: requestData,
                        apiData: cdxFilter(apiData),
                        suggestion: suggestion,
                    });
                });
        });
}

