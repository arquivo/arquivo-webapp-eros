
const ApiRequest = require('./api-request');
const config = require('config');

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
        }
        super(config.get('image.search.api'),defaultApiParams);
    }
}

module.exports = ImageSearchApiRequest;