const ApiRequest = require('./api-request');
const config = require('config');
const dateToTimestamp = require('../utils/date-to-timestamp');

class TitleSearchApiRequest extends ApiRequest {
    constructor() {
        const defaultApiParams = {
            title: null,
            q: null,
            from: config.get('search.start.date'),
            to: dateToTimestamp(new Date()),
            type: null,
            offset: 0,
            collection: null,
            maxItems: config.get('text.results.per.page'),
            fields: null,
            prettyPrint: false,
            trackingId: null,
        }
        let apiEndpoint = config.get('title.search.api');
        super(apiEndpoint,defaultApiParams);
    }

    sanitizeRequestData(requestData) {
        const apiRequestData = new URLSearchParams(requestData);

        ['type', 'collection'].forEach(inlineParam => {
            const requestParam = ['site','safe'].includes(inlineParam) ? inlineParam+'Search' : inlineParam;
            if (apiRequestData.has(requestParam)) {
                const regex = new RegExp(`\\s*${inlineParam}:${apiRequestData.get(requestParam)}\\s*`)
                apiRequestData.set('q', apiRequestData.get('q').split(regex).join(' '));
            }
        });
        return super.sanitizeRequestData(apiRequestData);
    }
}

module.exports = TitleSearchApiRequest;