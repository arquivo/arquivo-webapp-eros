const https = require('https');
const http = require('http');
const config = require('config');

module.exports = function (query, lang, callback) {
    let suggestionReply = '';
    let suggestion = query;

    const suggestionRequestData = new URLSearchParams({
        query: query,
        l: lang,
    });
    const suggestionUrl = config.get('query.suggestion.api')
    const get = suggestionUrl.startsWith('https') ? https.get : http.get;
    get(suggestionUrl + '?' + suggestionRequestData.toString(),
        (response) => {
            response.on('data', (d) => { suggestionReply = suggestionReply + d.toString().split("\n").join('') });
            response.on('end', () => {
                const suggestionRegex = /<div\s+id=['"]correction['"]><em>(.*)<\/em><\/div>/;
                if (suggestionRegex.test(suggestionReply)) {
                    suggestion = suggestionReply.match(suggestionRegex)[1];
                }
            });
            response.on('close', () => {
                callback(suggestion);
            })

        });
    // suggestionRequest.on('error',(e) => handleError(e));

}