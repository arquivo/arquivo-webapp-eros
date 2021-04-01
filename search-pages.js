const https = require('https');
const config = require('config');

const now = new Date();

const makeExportObject = function (req, res, apiRequestData, apiReplyData) {
    exportObject = []
    const exportSERPSaveLine = function () {
        let line = [];
        for (var i = 0; i < arguments.length; i++) {
            var a = arguments[i];
            line.push(a);
        }
        exportObject.push(line);
        return line;
    }
    exportSERPSaveLine(req.t('page-search.queryArgument'), req.t('page-search.queryValue'));
    exportSERPSaveLine(req.t('page-search.query'), apiRequestData.get('q'));
    exportSERPSaveLine(req.t('page-search.from'), apiRequestData.get('from'));
    exportSERPSaveLine(req.t('page-search.to'), apiRequestData.get('to'));
    exportSERPSaveLine(req.t('page-search.offset'), apiRequestData.get('offset'));
    exportSERPSaveLine(req.t('page-search.maxItems'), apiRequestData.get('maxItems'));
    exportSERPSaveLine(req.t('page-search.siteSearch'), apiRequestData.get('siteSearch'));
    exportSERPSaveLine(req.t('page-search.type'), apiRequestData.get('type'));
    exportSERPSaveLine(req.t('page-search.collection'), apiRequestData.get('collection'));
    exportSERPSaveLine(); // Add an empty line after all the arguments

    exportSERPSaveLine(req.t('page-search.results'));
    exportSERPSaveLine(
        req.t('page-search.year'),
        req.t('page-search.month'),
        req.t('page-search.day'),
        req.t('page-search.timestamp'),
        req.t('page-search.originalURL'),
        req.t('page-search.linkToArchive'),
        req.t('page-search.linkToScreenshot'),
        req.t('page-search.linkToExtractedText'),
        req.t('page-search.collection'),
        req.t('page-search.mimeType'),
        req.t('page-search.title'),
        req.t('page-search.snippet')
    );


    apiReplyData.response_items.forEach(currentDocument => {
        if (typeof currentDocument === 'undefined' || !currentDocument) {
            return;
        }

        let year = parseInt(currentDocument.tstamp.substring(0, 4));
        let month = req.t('common.months.' + currentDocument.tstamp.substring(4, 6));
        let day = parseInt(currentDocument.tstamp.substring(6, 8));

        // append result so it can be exported
        exportSERPSaveLine(
            year,
            month,
            day,
            currentDocument.tstamp,
            currentDocument.originalURL,
            currentDocument.linkToArchive,
            currentDocument.linkToScreenshot,
            currentDocument.linkToExtractedText,
            currentDocument.collection,
            currentDocument.mimeType,
            currentDocument.title,
            currentDocument.snippet
        );
    });

    return exportObject;
}
module.exports = function (req, res) {
    const requestData = new URLSearchParams(req.query);
    const defaultApiParams = {
        q: '',
        from: requestData.has('dateStart') ? requestData.get('dateStart').split('/').reverse().join('') : '19960101',
        to: (requestData.get('dateEnd') ?? now.toLocaleDateString('en-CA')).replaceAll('-', ''),
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

    Object.keys(defaultApiParams)
        .filter(key => defaultApiParams[key] !== null || requestData.has(key))
        .forEach(key => apiRequestData.set(key, requestData.get(key) ?? defaultApiParams[key]));

    { //putting "site:" on search query if needed and on siteSearch API param if present
        const siteQueryRegEx = /(\s|^)site:([^\s]+)/
        let q = apiRequestData.get('q');
        if (apiRequestData.has('siteSearch')) {
            if (!siteQueryRegEx.test(q)) {
                apiRequestData.set('q', q + ' site:' + apiRequestData.get('siteSearch'));
            }
        } else if (siteQueryRegEx.test(q)) {
            apiRequestData.set('siteSearch', q.match(siteQueryRegEx)[2])
        }
    }
    const suggestionRequest = require('./suggestion-api')
    const apiRequest = require('./page-search-api')

    suggestionRequest(req, res, (suggestion) => {
        apiRequest(req,res,(apiData) => {
            res.render('fragments/pages-search-results', {
                requestData: requestData,
                apiData: apiData,
                suggestion: suggestion,
                exportObject: makeExportObject(req, res, apiRequestData, apiData)
            });
        })
    });
}
