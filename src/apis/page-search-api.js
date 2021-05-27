const ApiRequest = require('./api-request');
const config = require('config');
class PageSearchApiRequest extends ApiRequest {
    constructor() {
        const defaultApiParams = {
            q: '',
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
        }
        super(config.get('text.search.api'),defaultApiParams);
    }
}

module.exports = PageSearchApiRequest;