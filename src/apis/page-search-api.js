const ApiRequest = require('./api-request');
const config = require('config');
class PageSearchApiRequest extends ApiRequest {
    constructor(backend=null) {
        const yearBalanceEnabled = config.has('text.search.api.yearBalance_enabled') &&
                                  config.get('text.search.api.yearBalance_enabled') === true;
        const defaultApiParams = {
            q: null,
            from: config.get('search.start.date'),
            to: (new Date()).toLocaleDateString('en-CA').split('-').join(''),
            type: null,
            offset: 0,
            siteSearch: null,
            collection: null,
            maxItems: config.get('text.results.per.page'),
            dedupValue: 1,
            dedupField: null,
            fields: null,
            prettyPrint: false,
            metadata: null,
            trackingId: null,
            yearBalance: yearBalanceEnabled ? true : null,
            language: null,
            minLanguageConfidence: null,
        }
        const defaultApiReply = {
            estimated_nr_results: 0,
            response_items: [],
            request_parameters: {
                from: defaultApiParams.from,
                to: defaultApiParams.to
            }
        };
        let apiEndpoint;
        switch (backend) {
            case 'solr':
                apiEndpoint = config.get('text.search.api.solr');
                break;
            case 'nutchwax':
                apiEndpoint = config.get('text.search.api.nutchwax');
                break;
            default:
                apiEndpoint = config.get('text.search.api.default');
                break;
        }
        super(apiEndpoint,defaultApiParams,defaultApiReply);
    }

    sanitizeRequestData(requestData) {
        const apiRequestData = new URLSearchParams(requestData);

        ['site', 'type', 'safe','size'].forEach(inlineParam => {
            const requestParam = ['site','safe'].includes(inlineParam) ? inlineParam+'Search' : inlineParam;
            if (apiRequestData.has(requestParam)) {
                const regex = new RegExp(String.raw`\s*${inlineParam}:${apiRequestData.get(requestParam)}\s*`)
                apiRequestData.set('q', apiRequestData.get('q').split(regex).join(' '));
            }
        });
        // these are always removed, so they never reach the API as search terms: their value may have been dropped
        // as invalid, and several collection terms are all sent together in the collection parameter
        ['collection', 'yearBalance', 'language', 'minLanguageConfidence'].forEach(inlineParam => {
            if (apiRequestData.has('q')) {
                const regex = new RegExp(String.raw`(?:^|\s+)${inlineParam}:\S+`, 'g');
                apiRequestData.set('q', apiRequestData.get('q').replace(regex, '').trim());
            }
        });
        return super.sanitizeRequestData(apiRequestData);
    }
}

module.exports = PageSearchApiRequest;