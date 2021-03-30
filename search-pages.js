const https = require('https');
const url = require('url');
const now = new Date();

const makeExportObject = function(req,res,apiRequestData,apiReplyData){
    exportObject = []
    const exportSERPSaveLine = function() {
        let line = [];
        for (var i=0; i < arguments.length; i++) {
            var a = arguments[i];
            line.push( a );
        }
        exportObject.push( line );
        return line;
    }
    exportSERPSaveLine(req.t('page-search.queryArgument'), req.t('page-search.queryValue'));
	exportSERPSaveLine(req.t('page-search.query'), apiRequestData.get('q'));
	exportSERPSaveLine(req.t('page-search.from'), apiRequestData.get('from'));
	exportSERPSaveLine(req.t('page-search.to'), apiRequestData.get('to'));
	exportSERPSaveLine(req.t('page-search.offset'), apiRequestData.get('offset'));
	exportSERPSaveLine(req.t('page-search.maxItems'), apiRequestData.get('maxItems'));
	exportSERPSaveLine(req.t('page-search.siteSearch'), apiRequestData.get('siteSearch'));
	exportSERPSaveLine(req.t('page-search.type'), apiRequestData.get('type'));
	exportSERPSaveLine(req.t('page-search.collection'), apiRequestData.get('collection'));
	exportSERPSaveLine(); // Add an empty line after all the arguments

    exportSERPSaveLine(req.t('page-search.results'));
    exportSERPSaveLine(
        req.t('page-search.year'),
        req.t('page-search.month'),
        req.t('page-search.day'),
        req.t('page-search.timestamp'),
        req.t('page-search.originalURL'),
        req.t('page-search.linkToArchive'),
        req.t('page-search.linkToScreenshot'),
        req.t('page-search.linkToExtractedText'),
        req.t('page-search.collection'),
        req.t('page-search.mimeType'),
        req.t('page-search.title'),
        req.t('page-search.snippet') 
    );

    
    apiReplyData.response_items.forEach(currentDocument => {
        if (typeof currentDocument === 'undefined' || !currentDocument) {
            return;
        }     

        let year = parseInt(currentDocument.tstamp.substring(0,4));
        let month = req.t('common.months.'+currentDocument.tstamp.substring(4,6));
        let day = parseInt(currentDocument.tstamp.substring(6,8));

        // append result so it can be exported
        exportSERPSaveLine(
            year,
            month,
            day,
            currentDocument.tstamp,
            currentDocument.originalURL,
            currentDocument.linkToArchive,
            currentDocument.linkToScreenshot,
            currentDocument.linkToExtractedText,
            currentDocument.collection,
            currentDocument.mimeType,
            currentDocument.title,
            currentDocument.snippet 
        );
    });

    return exportObject;
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
                    apiData: apiData,
                    exportObject: makeExportObject(req,res,apiRequestData,apiData)
                });
            });
        }
        
    });
    apiRequest.on('error',(e) => handleError(e));
    } catch (error) {
        handleError(error);
    }
    
}