const https = require('https');
const ApiRequest = require('./api-request');
const config = require('config');

class CDXSearchApiRequest extends ApiRequest {
    constructor() {
        const defaultApiParams = {
            output: 'json',
            from: config.get('search.start.date'),
            url: '',
            to: (new Date()).toLocaleDateString('en-CA').split('-').join(''),
            filter: '!:~status:4|5',
            fields: 'url,timestamp,status,digest'
        }
        super(config.get('cdx.api'), defaultApiParams);
        this.apiData = [];
        this.dataFunction = (requestData) => {
            return (d) => {
                this.apiReply = this.apiReply + d.toString();
                let endIndex = this.apiReply.indexOf('}') + 1;
                while (endIndex > 0) {
                    let currentJson = this.apiReply.slice(0, endIndex);
                    try {
                        let currentData = JSON.parse(currentJson);
                        this.apiData.push(currentData);
                    } catch {

                    }
                    this.apiReply = this.apiReply.slice(endIndex + 1)
                    endIndex = this.apiReply.indexOf('}') + 1;
                }
            };
        };
        this.endFunction = (requestData) => {return () => { }};
    }
    sanitizeRequestData(requestData) {
        const apiRequestData = new URLSearchParams(requestData);
        if (apiRequestData.has('q')) {
            apiRequestData.set('url', apiRequestData.get('q'));
        }
        return super.sanitizeRequestData(apiRequestData);
    }
}

module.exports = CDXSearchApiRequest