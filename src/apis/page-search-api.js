const ApiRequest = require('./api-request');
const config = require('config');
class PageSearchApiRequest extends ApiRequest {
    constructor() {
        const defaultApiParams = {
            q: null,
            from: config.get('search.start.date'),
            to: (new Date()).toLocaleDateString('en-CA').split('-').join(''),
            type: null,
            offset: 0,
            siteSearch: null,
            collection: null,
            maxItems: config.get('text.results.per.page'),
            dedupValue: null,
            dedupField: null,
            fields: null,
            prettyPrint: false,
            metadata: null,
            trackingId: null,
        }
        
        super(config.get('text.search.api'),defaultApiParams);
    }

    sanitizeRequestData(requestData) {
        const apiRequestData = new URLSearchParams(requestData);
        
        if (apiRequestData.has('type')) {
            const regex = new RegExp(`\\s*type:${apiRequestData.get('type')}\\s*`)
            apiRequestData.set('q', apiRequestData.get('q').split(regex).join(' '));
        }
        return super.sanitizeRequestData(apiRequestData);
    }
}

module.exports = PageSearchApiRequest;