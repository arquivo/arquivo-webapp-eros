const config = require('config');

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

    const defaultRequestParameters = {
        from: config.get('search.start.date'),
        to: (new Date()).toLocaleDateString('en-CA').split('-').join('')
    }

    Object.keys(defaultRequestParameters)
        .filter(key => !requestData.has(key))
        .forEach(key => requestData.set(key, defaultRequestParameters[key]));


    if(parseInt(requestData.get('from')) < parseInt(defaultRequestParameters.from)){
        requestData.set('from', defaultRequestParameters.from)
    }
    if(parseInt(requestData.get('to')) > parseInt(defaultRequestParameters.to)){
        requestData.set('to', defaultRequestParameters.to)
    }

    //handle all query inputs
    let q = requestData.get('q') ?? '';

    //convert advanced search params into query terms
    if (q == '') {
        q = requestData.get('adv_and') ?? '';
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
    } else { //Convert query into advanced search terms
        let adv_and = q;
        const phraseRegEx = /"[^"]*"/;
        let phrases = [];
        while(phraseRegEx.test(adv_and)){
            const phrase = adv_and.match(phraseRegEx)[0];
            adv_and = adv_and.split(phrase).join('');
            phrases.push(phrase.slice(1,-1));
        }
        if(phrases.length){
            requestData.set('adv_phr',phrases.pop());
        }

        const notRegEx = /-\w+/;
        let without = []
        while(notRegEx.test(adv_and)){
            const not = adv_and.match(notRegEx)[0];
            const splitRegEx = new RegExp(not + '(\\s|$)')
            adv_and = adv_and.split(splitRegEx).join('');
            without.push(not.slice(1))
        }
        if(without.length){
            requestData.set('adv_not',without.join(' '));
        }

        adv_and = adv_and.trim();

        const specialParamsRegEx = /(?:\s|^)(?:site|type|collection):(?:[^\s]+)/
        if(specialParamsRegEx.test(adv_and)){
            adv_and = adv_and.split(specialParamsRegEx)
                .map(t => t.trim())
                .filter(t => t != "")
                .join(' ');
        }

        if(phrases.length){
            adv_and = adv_and + ' ' + phrases.join(' ');
        }
        requestData.set('adv_and',adv_and);

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