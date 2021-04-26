//makes export json from Api request and reply
module.exports = function (req, res, apiRequestData, apiReplyData) {
    exportObject = []
    const exportSERPSaveLine = function () {
        let line = [];
        for (var i = 0; i < arguments.length; i++) {
            var a = arguments[i];
            line.push(a);
        }
        exportObject.push(line);
        return line;
    }
    exportSERPSaveLine(req.t('page-search.exports.queryArgument'), req.t('page-search.exports.queryValue'));
    exportSERPSaveLine(req.t('page-search.exports.query'), apiRequestData.get('q'));
    exportSERPSaveLine(req.t('page-search.exports.from'), apiRequestData.get('from'));
    exportSERPSaveLine(req.t('page-search.exports.to'), apiRequestData.get('to'));
    exportSERPSaveLine(req.t('page-search.exports.offset'), apiRequestData.get('offset'));
    exportSERPSaveLine(req.t('page-search.exports.maxItems'), apiRequestData.get('maxItems'));
    exportSERPSaveLine(req.t('page-search.exports.siteSearch'), apiRequestData.get('siteSearch'));
    exportSERPSaveLine(req.t('page-search.exports.type'), apiRequestData.get('type'));
    exportSERPSaveLine(req.t('page-search.exports.collection'), apiRequestData.get('collection'));
    exportSERPSaveLine(); // Add an empty line after all the arguments

    exportSERPSaveLine(req.t('page-search.exports.results'));
    exportSERPSaveLine(
        req.t('page-search.exports.year'),
        req.t('page-search.exports.month'),
        req.t('page-search.exports.day'),
        req.t('page-search.exports.timestamp'),
        req.t('page-search.exports.originalURL'),
        req.t('page-search.exports.linkToArchive'),
        req.t('page-search.exports.linkToScreenshot'),
        req.t('page-search.exports.linkToExtractedText'),
        req.t('page-search.exports.collection'),
        req.t('page-search.exports.mimeType'),
        req.t('page-search.exports.title'),
        req.t('page-search.exports.snippet')
    );


    apiReplyData.response_items.forEach(currentDocument => {
        if (typeof currentDocument === 'undefined' || !currentDocument) {
            return;
        }

        let year = parseInt(currentDocument.tstamp.substring(0, 4));
        let month = req.t('common.months.' + currentDocument.tstamp.substring(4, 6));
        let day = parseInt(currentDocument.tstamp.substring(6, 8));

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