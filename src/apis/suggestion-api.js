const ApiRequest = require('./api-request')
const config = require('config');

class SuggestionApiRequest extends ApiRequest {
    constructor() {
        const defaultApiParams = {
            query: '',
            l: 'pt',
        }
        const defaultApiReply = '';

        super(config.get('query.suggestion.api'),defaultApiParams,'');

        // Don't spend too long waiting for a suggestion, sometimes the service is down and it's not that important
        this.options = {timeout: 1000};

        this.dataFunction = (requestData) => { return (d) => { this.apiReply = this.apiReply + d.toString().split("\n").join(''); } };
        this.endFunction = (requestData) => { return () => { 
            const suggestionRegex = /<div\s+id=['"]correction['"]><em>(.*)<\/em><\/div>/;
            if (suggestionRegex.test(this.apiReply)) {
                this.apiData = this.apiReply.match(suggestionRegex)[1];
            } else {
                this.apiData = requestData.get('query') || '';
            }

        } };
        this.errorFunction = (requestData, callback) => { return (e) => { this.logger.error(e); callback(requestData.get('query') || ''); } };
    }

    getSuggestion (query, lang, callback) {
        const requestData = new URLSearchParams({
            query: query,
            l: lang,
        });
        this.get(requestData,callback);
    }
}


module.exports = SuggestionApiRequest;