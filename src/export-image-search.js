//makes export json from Api request and reply
const exportResults = require('./export-results');

module.exports = function (apiRequestData, apiReplyData, translateFunction) {
    return exportResults(apiRequestData,apiReplyData.responseItems,translateFunction,'imgTstamp',[
        'year',
        'month',
        'day',
        'imgTstamp',
        'imgHeight',
        'imgWidth',
        'imgSrc',
        'imgLinkToArchive',
        'collection',
        'imgMimeType',
        'imgAlt',
        'imgTitle',
        'pageTstamp',
        'pageURL',
        'pageLinkToArchive',
        'pageTitle',
    ]);
}