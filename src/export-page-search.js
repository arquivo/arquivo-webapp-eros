
/**
 * Page Search Export
 * 
 * Exports page/text search results with page-specific fields including:
 * - Timestamp and date components (year, month, day)
 * - Original URL and archive links
 * - Screenshot and extracted text links
 * - Collection, MIME type
 * - Title and snippet
 * 
 * Uses 'tstamp' as the timestamp field for date extraction.
 */

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