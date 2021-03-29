const https = require('https');
const url = require('url');
const now = new Date();

const getApiData = function(apiRequestData){
    return new Promise((resolve,reject) => {
        
    });
}

module.exports = function (req,res) {
    const itemsPerPage = 10;
    const requestData = new URL(req.url,req.protocol+'://'+req.headers.host).searchParams;
    const apiRequestData = new URLSearchParams({
        q: requestData.get('q') ?? '',
        from: requestData.has('dateStart') ? requestData.get('dateStart').split('/').reverse().join('')  : '19960101',
        to: (requestData.get('dateEnd') ?? now.toLocaleDateString('pt-PT')).split('/').reverse().join(''),
        offset: requestData.has('page') ? Math.max(itemsPerPage * (requestData.get('page')-1),0) : 0,
        maxItems: itemsPerPage,
    });
    let apiReply = ''
    const handleError = function(e){
        res.send(
            '<pre>'+e.toString()+'</pre>'+
            '<br>'+
            '<pre>'+e.trace+'</pre>'
        );
    }
    try {
    const apiRequest = https.get('https://arquivo.pt/pagesearch/textsearch?'+apiRequestData.toString(),
    (response) => {
        if (response.statusCode != 200) {
            console.log('Invalid status code <' + response.statusCode + '>');
        } else {
            response.on('data', (d) => {apiReply = apiReply+d.toString()});
            response.on('end', () => {
                const apiData = JSON.parse(apiReply);
                res.render('pages/pages-search-results',{
                    requestData: requestData,
                    apiData: apiData
                });
            });
        }
        
    });
    apiRequest.on('error',(e) => handleError(e));
    } catch (error) {
        handleError(error);
    }
    
}