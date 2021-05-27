const https = require('https');
class ApiRequest {
    constructor(apiUrl,defaultApiParams={}) {
        this.apiReply = '';
        this.apiData = {};
        this.apiUrl = apiUrl;
        this.defaultApiParams = defaultApiParams;
        this.dataFunction = (d) => { this.apiReply = this.apiReply + d.toString(); };
        this.endFunction = () => { this.apiData = JSON.parse(this.apiReply); };
        this.closeFunction = (callback) => {return () => { callback(this.apiData); }};
    }

    get(requestData, callback) {
        https.get(this.apiUrl + '?' + this.sanitizeRequestData(requestData).toString(),
            (apiRes) => {
                apiRes.on('data', this.dataFunction);
                apiRes.on('end', this.endFunction);
                apiRes.on('close', this.closeFunction(callback));
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