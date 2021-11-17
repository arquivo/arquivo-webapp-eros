const config = require('config');
const { request } = require('express');

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

    //remove redundant language information
    if(requestData.has('l') && requestData.get('l') == req.getLanguage()){
        requestData.delete('l');
    }
    
    if(parseInt(requestData.get('from')) < parseInt(defaultRequestParameters.from)){
        requestData.set('from', defaultRequestParameters.from)
    }
    if(parseInt(requestData.get('to')) > parseInt(defaultRequestParameters.to)){
        requestData.set('to', defaultRequestParameters.to)
    }

    //Clean empty fields
    [...requestData.keys()]
        .filter(key => requestData.get(key).trim() === '')
        .forEach(key => requestData.delete(key));

    //handle all query inputs
    let q = requestData.get('q') ?? '';

    //convert advanced search params into query terms
    if (q != '') { //Convert query into advanced search terms
        
        let adv_and = q;

        //Handling exact phrases (between double quotes)
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

        //Handling excluding terms (with preceding '-')
        const notRegEx = /-[^\s]+/;
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

        //Handling special terms (type, site and collection)
        const specialParamsRegEx = /(?:\s|^)(?:site|type|collection|safe|size):(?:[^\s]+)/
        if(specialParamsRegEx.test(adv_and)){

            // putting "site","type" and "collection" on API params if needed.
            ['site', 'type', 'collection','safe','size'].forEach(t => {
                const regexString = '(\\s|^)' + t + ':([^\\s]+)';
                const queryRegEx = new RegExp(regexString);
                const requestParam = ['site','safe'].includes(t) ? t+'Search' : t;
                if (!requestData.has(requestParam) && queryRegEx.test(adv_and)) {
                    requestData.set(requestParam, adv_and.match(queryRegEx)[2])
                }
            })

            // removing special terms from advanced search input
            adv_and = adv_and.split(specialParamsRegEx)
                .map(t => t.trim())
                .filter(t => t != "")
                .join(' ');
        }

        // adding leftover phrases to advanced search input
        if(phrases.length){
            adv_and = (adv_and + ' ' + phrases.map(p => '"'+p+'"').join(' ')).trim();
        }
        requestData.set('adv_and',adv_and);

    }

    // remove 'all' from type 
    if (requestData.get('type') == 'all') {
        requestData.delete('type');
    }

    fullquery=[
         requestData.get('adv_and') ?? '',
        [requestData.get('adv_phr') ?? '']           .filter(t => t != '').map(t => `"${t}"`).join(''),
        (requestData.get('adv_not') ?? '').split(' ').filter(t => t != '').map(t => `-${t}`).join(' '),
        [requestData.get('siteSearch') ?? '']        .filter(t => t != '').map(t => `site:${t}`).join(''),
        [requestData.get('size') ?? '']              .filter(t => t != '').map(t => `size:${t}`).join(''),
        [requestData.get('type') ?? '']              .filter(t => t != '').map(t => `type:${t}`).join(''),
        [requestData.get('collection') ?? '']        .filter(t => t != '').map(t => `collection:${t}`).join(''),
        [requestData.get('safeSearch') ?? '']        .filter(t => t != '').map(t => `safe:${t}`).join(''),
    ]
    requestData.set('q', fullquery.filter(t => t!='').join(' '));
    return requestData;
}