
const ApiRequest = require('./api-request');
const config = require('config');
const dateToTimestamp = require('../utils/date-to-timestamp');

class ImageSearchApiRequest extends ApiRequest {
    constructor() {
        const defaultApiParams = {
            q: '',
            from: config.get('search.start.date'),
            to: dateToTimestamp(new Date()),
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

        ['site', 'type', 'collection', 'size', 'safe'].forEach(inlineParam => {
            const requestParam = ['site','safe'].includes(inlineParam) ? inlineParam+'Search' : inlineParam;
            if (apiRequestData.has(requestParam)) {
                const regex = new RegExp(`\\s*${inlineParam}:${apiRequestData.get(requestParam)}\\s*`)
                apiRequestData.set('q', apiRequestData.get('q').split(regex).join(' '));
            }
        });
        return super.sanitizeRequestData(apiRequestData);
    }
}

module.exports = ImageSearchApiRequest;