const https = require('https');
class ApiRequest {
    constructor(apiUrl,defaultApiParams={}) {
        this.apiReply = '';
        this.apiData = {};
        this.apiUrl = apiUrl;
        this.defaultApiParams = defaultApiParams;
        this.dataFunction = (requestData) => { return (d) => { this.apiReply = this.apiReply + d.toString(); }};
        this.endFunction = (requestData) => { return () => { this.apiData = JSON.parse(this.apiReply); }};
        this.closeFunction = (requestData, callback) => {return () => { callback(this.apiData); }};
    }

    get(requestData, callback) {
        https.get(this.apiUrl + '?' + this.sanitizeRequestData(requestData).toString(),
            (apiRes) => {
                apiRes.on('data', this.dataFunction(requestData));
                apiRes.on('end', this.endFunction(requestData));
                apiRes.on('close', this.closeFunction(requestData, callback));
            });
    }

    sanitizeRequestData(requestData){
        const apiRequestData = new URLSearchParams();

        //Load parameters onto api request data
        Object.keys(this.defaultApiParams)
            .filter(key => this.defaultApiParams[key] !== null || requestData.has(key))
            .forEach(key => apiRequestData.set(key, requestData.get(key) ?? this.defaultApiParams[key]));
        return apiRequestData;
    }
}
module.exports = ApiRequest