/**
 * Export Results Utility
 *
 * Converts API request/response data into a structured array format for export.
 * Creates a table-like structure with:
 * - Query parameters section (query, dates, offset, maxItems, etc.)
 * - Empty separator line
 * - Results section header
 * - Column headers (translated field names)
 * - Data rows with extracted year/month/day from timestamp
 *
 * @param {URLSearchParams} apiRequestData - Search parameters from the request
 * @param {Array} apiResponseItems - Result items from API response
 * @param {Function} translateFunction - i18n translation function
 * @param {string} timstampField - Field name containing timestamp (e.g., 'tstamp', 'imgTstamp')
 * @param {Array<string>} displayFields - List of fields to include in export
 * @returns {Array<Array>} 2D array suitable for CSV/JSON export
 */

function exportSERPSaveLine(exportObject, ...args) {
    exportObject.push(args);
    return args;
}

//makes export json from Api request and reply
module.exports = function exportResults(apiRequestData, apiResponseItems, translateFunction, timstampField, displayFields) {
    const exportObject = [];
    const saveLine = (...args) => exportSERPSaveLine(exportObject, ...args);

    saveLine(translateFunction('exports.queryArgument'), translateFunction('exports.queryValue'));
    saveLine(translateFunction('exports.query'), apiRequestData.get('q'));
    saveLine(translateFunction('exports.from'), apiRequestData.get('from'));
    saveLine(translateFunction('exports.to'), apiRequestData.get('to'));
    saveLine(translateFunction('exports.offset'), apiRequestData.get('offset'));
    saveLine(translateFunction('exports.maxItems'), apiRequestData.get('maxItems'));
    saveLine(translateFunction('exports.siteSearch'), apiRequestData.get('siteSearch'));
    saveLine(translateFunction('exports.type'), apiRequestData.get('type'));
    saveLine(translateFunction('exports.collection'), apiRequestData.get('collection'));
    saveLine(); // Add an empty line after all the arguments

    saveLine(translateFunction('exports.results'));

    saveLine(
        ...displayFields.map(field => translateFunction('exports.'+field))
    );

    (apiResponseItems ?? [])
        .map(d => ({...d})) //clone elements to avoid changing original data
        .forEach(currentDocument => {
        if (!currentDocument) {
            return;
        }

        currentDocument.year = Number.parseInt(currentDocument[timstampField].substring(0, 4));
        currentDocument.month = translateFunction('common.months.' + currentDocument[timstampField].substring(4, 6));
        currentDocument.day = Number.parseInt(currentDocument[timstampField].substring(6, 8));

        // append result so it can be exported
        saveLine(
            ...displayFields.map(field => currentDocument[field])
        );
    });

    return exportObject;
}
