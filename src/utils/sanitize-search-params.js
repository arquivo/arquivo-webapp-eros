const config = require('config');

// Converts old input parameters into new ones, the same as API request parameters
// (for compatibility with old arquivo searches)

function transformParameterName(target, oldName, newName, valueTransformationFunction = (v) => v) {
    if (target.has(oldName) && !target.has(newName)) {
        target.set(newName, valueTransformationFunction(target.get(oldName)));
        target.delete(oldName);
    }
}

function extractPhrases(inputStr) {
    const phraseRegEx = /"[^"]*"/;
    let adv_and = inputStr;
    const phrases = [];
    while (phraseRegEx.test(adv_and)) {
        const phrase = phraseRegEx.exec(adv_and)[0];
        adv_and = adv_and.split(phrase).join('');
        phrases.push(phrase.slice(1, -1));
    }
    return { adv_and, phrases };
}

function extractNotTerms(inputStr, requestData) {
    const notRegEx = /(^|\s)-[^\s]+/g;
    if (!notRegEx.test(inputStr)) {
        return inputStr;
    }
    const without = inputStr.match(notRegEx).map(t => t.trim().slice(1));
    const cleaned = inputStr.split(notRegEx).map(t => t.trim()).filter(t => t !== '').join(' ');
    if (without.length) {
        requestData.set('adv_not', without.join(' '));
    }
    return cleaned;
}

function extractSpecialParams(inputStr, requestData) {
    const specialParamsRegEx = /(?:\s|^)(?:site|type|collection|safe|size):(?:[^\s]+)/;
    if (!specialParamsRegEx.test(inputStr)) {
        return inputStr;
    }
    ['site', 'type', 'collection', 'safe', 'size'].forEach(t => {
        const queryRegEx = new RegExp(String.raw`(\s|^)` + t + String.raw`:([^\s]+)`);
        const requestParam = ['site', 'safe'].includes(t) ? t + 'Search' : t;
        if (!requestData.has(requestParam) && queryRegEx.test(inputStr)) {
            requestData.set(requestParam, queryRegEx.exec(inputStr)[2]);
        }
    });
    return inputStr.split(specialParamsRegEx).map(t => t.trim()).filter(t => t !== '').join(' ');
}

module.exports = function sanitizeSearchParams(req, res) {
    const requestData = new URLSearchParams(req.query);

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
    transformParameterName(requestData, 'site', 'siteSearch', (v) => v.split(/\s/).join(''));
    transformParameterName(requestData, 'hitsPerDup', 'dedupValue');

    const defaultRequestParameters = {
        from: config.get('search.start.date'),
        to: (new Date()).toLocaleDateString('en-CA').split('-').join('')
    }

    Object.keys(defaultRequestParameters)
        .filter(key => !requestData.has(key))
        .forEach(key => requestData.set(key, defaultRequestParameters[key]));

    if (Number.parseInt(requestData.get('from')) < Number.parseInt(defaultRequestParameters.from)) {
        requestData.set('from', defaultRequestParameters.from)
    }
    if (Number.parseInt(requestData.get('to')) > Number.parseInt(defaultRequestParameters.to)) {
        requestData.set('to', defaultRequestParameters.to)
    }

    //Clean empty fields
    [...requestData.keys()]
        .filter(key => requestData.get(key).trim() === '')
        .forEach(key => requestData.delete(key));

    //handle all query inputs
    let q = requestData.get('q') ?? '';

    //convert advanced search params into query terms
    if (q !== '') {
        let { adv_and, phrases } = extractPhrases(q);

        if (phrases.length) {
            requestData.set('adv_phr', phrases.pop());
        }

        adv_and = extractNotTerms(adv_and, requestData);
        adv_and = extractSpecialParams(adv_and.trim(), requestData);

        // adding leftover phrases to advanced search input
        if (phrases.length) {
            adv_and = (adv_and + ' ' + phrases.map(p => `"${p}"`).join(' ')).trim();
        }
        requestData.set('adv_and', adv_and);
    }

    // remove default settings
    if (requestData.get('type') === 'all') {
        requestData.delete('type');
    }
    if (requestData.get('size') === 'all') {
        requestData.delete('size');
    }
    if (requestData.get('safeSearch') === 'on') {
        requestData.delete('safeSearch');
    }


    if (q === '') {
        let fullquery = [
            requestData.get('adv_and') ?? '',
           [requestData.get('adv_phr') ?? '']           .filter(t => t !== '').map(t => `"${t}"`).join(''),
           (requestData.get('adv_not') ?? '').split(' ').filter(t => t !== '').map(t => `-${t}`).join(' '),
           [requestData.get('siteSearch') ?? '']        .filter(t => t !== '').map(t => `site:${t}`).join(''),
           [requestData.get('size') ?? '']              .filter(t => t !== '').map(t => `size:${t}`).join(''),
           [requestData.get('type') ?? '']              .filter(t => t !== '').map(t => `type:${t}`).join(''),
           [requestData.get('collection') ?? '']        .filter(t => t !== '').map(t => `collection:${t}`).join(''),
           [requestData.get('safeSearch') ?? '']        .filter(t => t !== '').map(t => `safe:${t}`).join(''),
       ]
        requestData.set('q', fullquery.filter(t => t !== '').join(' '));
    }
    return requestData;
}
