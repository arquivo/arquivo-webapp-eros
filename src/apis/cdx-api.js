const https = require('https');
const config = require('config');

module.exports = function (apiRequestData, callback) {
    let apiReply = '';
    let apiData = [];
    const apiRequest = https.get(config.get('cdx.api') + '?' + apiRequestData.toString(),
        (apiRes) => {
            apiRes.on('data', (d) => {
                apiReply = apiReply + d.toString();
                let endIndex = apiReply.indexOf('}') + 1;
                while (endIndex > 0) {
                    apiData.push(JSON.parse(apiReply.slice(0, endIndex)))
                    apiReply = apiReply.slice(endIndex + 1)
                    endIndex = apiReply.indexOf('}') + 1;
                }
            });
            apiRes.on('end', () => {

            });
            apiRes.on('close', () => {
                callback(apiData);
            });

        });
}