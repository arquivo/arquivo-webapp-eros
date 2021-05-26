
const https = require('https');
const config = require('config');

module.exports = function (apiRequestData, callback) {
    let apiReply = '';
    let apiData = {};
    const apiRequest = https.get(config.get('image.search.api') + '?' + apiRequestData.toString(),
        (apiRes) => {
            apiRes.on('data', (d) => { apiReply = apiReply + d.toString(); });
            apiRes.on('end', () => {
                apiData = JSON.parse(apiReply);
            });
            apiRes.on('close', () => {
                callback(apiData);
            });

        });
}