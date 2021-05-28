
//makes export json from Api request and reply
const exportResults = require('./export-results');

module.exports = function (apiRequestData, apiReplyData, translateFunction) {
    return exportResults(apiRequestData,apiReplyData.response_items,translateFunction,'tstamp',[
        'year',
        'month',
        'day',
        'tstamp',
        'originalURL',
        'linkToArchive',
        'linkToScreenshot',
        'linkToExtractedText',
        'collection',
        'mimeType',
        'title',
        'snippet'
    ]);
}