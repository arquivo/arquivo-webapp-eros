const config = require('config');
const sanitizeInputs = require('./sanitize-search-params');
const makeExportObject = require('./export-object')    
const suggestionRequest = require('./suggestion-api')
const apiRequest = require('./page-search-api')


const now = new Date();

module.exports = function (req, res) {
    const requestData = sanitizeInputs(req, res);
    const defaultApiParams = {
        q: '',
        from: config.get('search.start.date'),
        to: now.toLocaleDateString('en-CA').split('-').join(''),
        type: null,
        offset: 0,
        siteSearch: null,
        collection: null,
        maxItems: config.get('text.results.per.page'),
        dedupValue: null,
        dedupField: null,
        fields: null,
        prettyPrint: false,
    }
    const apiRequestData = new URLSearchParams();

    //Load parameters onto api request data
    Object.keys(defaultApiParams)
        .filter(key => defaultApiParams[key] !== null || requestData.has(key))
        .forEach(key => apiRequestData.set(key, requestData.get(key) ?? defaultApiParams[key]));


    suggestionRequest(apiRequestData.get('q'), apiRequestData.get('l') ?? 'pt',
        (suggestion) => {
            apiRequest(apiRequestData,
                (apiData) => {
                    res.render('partials/pages-search-results', {
                        requestData: requestData,
                        apiData: apiData,
                        suggestion: suggestion,
                        exportObject: makeExportObject(req, res, apiRequestData, apiData)
                    });
                })
        });
}
