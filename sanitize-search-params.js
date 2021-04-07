
// Converts old input parameters into new ones, the same as API request parameters 
// (for compatibility with old arquivo searches)

module.exports = function (req, res) {

    const requestData = new URLSearchParams(req.query);

    /**
     * Deletes oldName parameter from target, setting newName with its value if newName 
     *  isn't set yet. If given, applies valueTransformationFunction on old value before setting it.
     * @param  {URLSearchParams}    target                          target URLSearchParams object
     * @param  {string}             oldName                         old parameter name
     * @param  {string}             newName                         new parameter name
     * @param  {function}           [valueTransformationFunction]   value modification function. Should have old value as its single argument and return the new value.
     */
    const transformParameterName = function (target, oldName, newName, valueTransformationFunction = (v) => v) {
        if (target.has(oldName) && !target.has(newName)) {
            target.set(newName, valueTransformationFunction(target.get(oldName)));
            target.delete(oldName);
        }
    }

    //Normal search parameters
    transformParameterName(requestData, 'dateStart', 'from', (v) => v.split('/').reverse().join(''));
    transformParameterName(requestData, 'ion-dt-0', 'from', (v) => v.split('-').join(''));
    transformParameterName(requestData, 'dateEnd', 'to', (v) => v.split('/').reverse().join(''));
    transformParameterName(requestData, 'ion-dt-1', 'to', (v) => v.split('-').join(''));
    transformParameterName(requestData, 'query', 'q');
    transformParameterName(requestData, 'start', 'offset');

    //Advanced search parameters
    transformParameterName(requestData, 'format', 'type');
    transformParameterName(requestData, 'adv_mime', 'type');
    transformParameterName(requestData, 'hitsPerPage', 'maxItems');
    transformParameterName(requestData, 'site', 'siteSearch');
    transformParameterName(requestData, 'hitsPerDup', 'dedupValue');


    //handle all query inputs
    let q = requestData.get('q') ?? '';

    //convert advanced search params into query terms
    if (q == '') {
        q = requestData.get('adv_and').trim() ?? '';
        if (requestData.has('adv_phr') && requestData.get('adv_phr').trim() != '') {
            q += ' "' + requestData.get('adv_phr').trim() + '"';
        }
        if (requestData.has('adv_not')) {
            q += ' ' + requestData.get('adv_not')
                .split(/\s+/)
                .filter(t => t !== '')
                .map(t => '-' + t)
                .join(' ')
        }
    }

    // remove 'all' from type 
    if (requestData.get('type') == 'all') {
        requestData.delete('type');
    }

    // putting "site","type" and "collection" on search query if needed and on API params if present.
    ['site', 'type', 'collection'].forEach(t => {
        const queryRegEx = new RegExp('(\\s|^)' + t + ':([^\\s]+)');
        const requestParam = t == 'site' ? 'siteSearch' : t;
        if (requestData.has(requestParam)) {
            if (!queryRegEx.test(q)) {
                q = q + ' ' + t + ':' + requestData.get(requestParam);
            }
        } else if (queryRegEx.test(q)) {
            requestData.set(requestParam, q.match(queryRegEx)[2])
        }

    })

    requestData.set('q', q.trim());

    return requestData;
}