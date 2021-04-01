
const https = require('https');
const config = require('config');

module.exports = function (req, res, callback) {
    
    const apiRequestData = new URLSearchParams(req.query)
    let apiReply = '';
    let apiData = {};
    const apiRequest = https.get(config.get('text.search.api') + '?' + apiRequestData.toString(),
        (apiRes) => {
            apiRes.on('data', (d) => { apiReply = apiReply + d.toString() });
            apiRes.on('end', () => {
                apiData = JSON.parse(apiReply);
            });
            apiRes.on('close', () => {
                callback(JSON.parse(apiReply));
            });

        });
}