const https = require('https');
const config = require('config');

module.exports = function (req,res,callback) {
    const apiRequestData = new URLSearchParams(req.query)
    let suggestionReply = '';
    let suggestion = apiRequestData.get('q');
    
    const suggestionRequestData = new URLSearchParams({
        query: apiRequestData.get('q'),
        l: apiRequestData.get('l') ?? 'pt',
    });
    https.get(config.get('query.suggestion.api')+'?'+suggestionRequestData.toString(),
    (response) => {
        response.on('data', (d) => {suggestionReply = suggestionReply+d.toString().replaceAll("\n","")});
        response.on('end', () => {
            const suggestionRegex = /<div\s+id=['"]correction['"]><em>(.*)<\/em><\/div>/;
            if(suggestionRegex.test(suggestionReply)){
                suggestion = suggestionReply.match(suggestionRegex)[1];
            }
        });
        response.on('close',() => {
            callback(suggestion);
        })
        
    });
    // suggestionRequest.on('error',(e) => handleError(e));

}