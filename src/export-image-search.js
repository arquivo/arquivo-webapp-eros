/**
 * Image Search Export
 * 
 * Exports image search results with image-specific fields including:
 * - Image timestamp, dimensions (height, width)
 * - Image source URL and archive link
 * - Image metadata (MIME type, alt text, title)
 * - Parent page information (timestamp, URL, archive link, title)
 * - Collection information
 * 
 * Uses 'imgTstamp' as the timestamp field for date extraction.
 */

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