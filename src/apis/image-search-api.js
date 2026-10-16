
const ApiRequest = require('./api-request');
const config = require('config');
const removeInlineTerms = require('../utils/remove-inline-terms');

// Inline terms the image search API doesn't understand in the query, where it would search them as words.
// collection is sent in its own parameter, the others only apply to page search.
const PAGE_ONLY_INLINE_PARAMS = ['collection', 'yearBalance', 'language', 'minLanguageConfidence'];

class ImageSearchApiRequest extends ApiRequest {
    constructor() {
        const defaultApiParams = {
            q: '',
            from: config.get('search.start.date'),
            to: (new Date()).toLocaleDateString('en-CA').split('-').join(''),
            type: null,
            offset: 0,
            siteSearch: null,
            collection: null,
            maxItems: config.get('image.results.per.page'),
            dedupValue: null,
            dedupField: null,
            fields: 'imgSrc,imgMimeType,imgHeight,imgWidth,imgTstamp,imgTitle,imgAlt,imgCaption,imgLinkToArchive,pageURL,pageTstamp,pageLinkToArchive,pageTitle,collection,imgDigest,pageHost,pageImages,safe',
            prettyPrint: false,
            size:'all',
            safeSearch:'on',
            trackingId: null,
        }
        super(config.get('image.search.api'),defaultApiParams);
    }

    sanitizeRequestData(requestData) {
        const apiRequestData = new URLSearchParams(requestData);
        if (apiRequestData.has('q')) {
            apiRequestData.set('q', removeInlineTerms(apiRequestData.get('q'), PAGE_ONLY_INLINE_PARAMS));
        }
        return super.sanitizeRequestData(apiRequestData);
    }
}

module.exports = ImageSearchApiRequest;