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
        this.dataFunction = (requestData) => { return (d) => { this.apiReply = this.apiReply + d.toString().split("\n").join(''); } };
        this.endFunction = (requestData) => { return () => { 
            const suggestionRegex = /<div\s+id=['"]correction['"]><em>(.*)<\/em><\/div>/;
            if (suggestionRegex.test(this.apiReply)) {
                this.apiData = this.apiReply.match(suggestionRegex)[1];
            }
        } };
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