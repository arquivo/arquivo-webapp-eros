//makes export json from Api request and reply
module.exports = function (apiRequestData, apiResponseItems, translateFunction, timstampField, displayFields) {
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
    exportSERPSaveLine(translateFunction('exports.queryArgument'), translateFunction('exports.queryValue'));
    exportSERPSaveLine(translateFunction('exports.query'), apiRequestData.get('q'));
    exportSERPSaveLine(translateFunction('exports.from'), apiRequestData.get('from'));
    exportSERPSaveLine(translateFunction('exports.to'), apiRequestData.get('to'));
    exportSERPSaveLine(translateFunction('exports.offset'), apiRequestData.get('offset'));
    exportSERPSaveLine(translateFunction('exports.maxItems'), apiRequestData.get('maxItems'));
    exportSERPSaveLine(translateFunction('exports.siteSearch'), apiRequestData.get('siteSearch'));
    exportSERPSaveLine(translateFunction('exports.type'), apiRequestData.get('type'));
    exportSERPSaveLine(translateFunction('exports.collection'), apiRequestData.get('collection'));
    exportSERPSaveLine(); // Add an empty line after all the arguments

    exportSERPSaveLine(translateFunction('exports.results'));



    exportSERPSaveLine(
        ...displayFields.map(field => translateFunction('exports.'+field))
    );


    apiResponseItems.forEach(currentDocument => {
        if (typeof currentDocument === 'undefined' || !currentDocument) {
            return;
        }

        currentDocument.year = parseInt(currentDocument[timstampField].substring(0, 4));
        currentDocument.month = translateFunction('common.months.' + currentDocument[timstampField].substring(4, 6));
        currentDocument.day = parseInt(currentDocument[timstampField].substring(6, 8));

        // append result so it can be exported
        exportSERPSaveLine(
            ...displayFields.map(field => currentDocument[field])
        );
    });

    return exportObject;
}