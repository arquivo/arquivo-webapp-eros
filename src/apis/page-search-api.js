const ApiRequest = require('./api-request');
const config = require('config');

// Search terms typed in the query (e.g. collection:Roteiro) that are sent to the API as their own parameter
const INLINE_PARAMS = ['site', 'type', 'collection', 'safe', 'size'];
const inlineParamRequestName = (inlineParam) => ['site','safe'].includes(inlineParam) ? inlineParam+'Search' : inlineParam;

class PageSearchApiRequest extends ApiRequest {
    constructor(backend=null, options={}) {
        const yearBalanceEnabled = config.has('text.search.api.yearBalance_enabled') &&
                                  config.get('text.search.api.yearBalance_enabled') === true;
        const defaultApiParams = {
            q: null,
            from: config.get('search.start.date'),
            to: (new Date()).toLocaleDateString('en-CA').split('-').join(''),
            type: null,
            offset: 0,
            siteSearch: null,
            collection: null,
            maxItems: config.get('text.results.per.page'),
            dedupValue: 1,
            dedupField: null,
            fields: null,
            prettyPrint: false,
            metadata: null,
            trackingId: null,
            yearBalance: yearBalanceEnabled ? true : null,
        }
        const defaultApiReply = {
            estimated_nr_results: 0,
            response_items: [],
            request_parameters: {
                from: defaultApiParams.from,
                to: defaultApiParams.to
            }
        };
        let apiEndpoint;
        switch (backend) {
            case 'solr':
                apiEndpoint = config.get('text.search.api.solr');
                break;
            case 'nutchwax':
                apiEndpoint = config.get('text.search.api.nutchwax');
                break;
            default:
                apiEndpoint = config.get('text.search.api.default');
                break;
        }
        super(apiEndpoint,defaultApiParams,defaultApiReply);
        Object.assign(this.options, options);

        this.spellcheckEnabled = config.has('text.search.api.spellcheck_enabled') &&
                                config.get('text.search.api.spellcheck_enabled') === true;
    }

    /**
     * Returns a copy of requestData that also asks the API to spellcheck the query
     * (adds 'spellcheck' to the requested fields, keeping any other requested fields).
     * The API replies with the corrected query in `suggested_query`.
     *
     * @param {URLSearchParams} requestData - Search request parameters
     * @returns {URLSearchParams} Request parameters with spellcheck requested (if enabled)
     */
    withSpellcheck(requestData) {
        if (!this.spellcheckEnabled) {
            return requestData;
        }
        const spellcheckRequestData = new URLSearchParams(requestData);
        const fields = (requestData.get('fields') ?? '').split(',').map(f => f.trim()).filter(f => f !== '');
        if (!fields.includes('spellcheck')) {
            fields.push('spellcheck');
        }
        spellcheckRequestData.set('fields', fields.join(','));
        return spellcheckRequestData;
    }

    /**
     * Gets the spellchecked query from an API reply
     *
     * The API only spellchecks what's left of the query after sanitizeRequestData moves the
     * inline terms (e.g. collection:Roteiro) to their own parameters, so those are added back
     * to the suggestion, as typed, for the suggested search to keep them.
     *
     * @param {Object} apiData - API reply
     * @param {URLSearchParams} requestData - Search request parameters
     * @returns {string} Suggested query, or the original query if there is no suggestion
     */
    getSuggestion(apiData, requestData) {
        const suggestion = apiData?.suggested_query?.trim();
        if (!suggestion) {
            return requestData.get('q');
        }
        return [suggestion, ...this.getInlineTerms(requestData)].join(' ');
    }

    /**
     * Inline terms of the query (e.g. collection:Roteiro) that sanitizeRequestData removes from it
     *
     * @param {URLSearchParams} requestData - Search request parameters
     * @returns {string[]} Inline terms, as typed in the query
     */
    getInlineTerms(requestData) {
        const queryTerms = (requestData.get('q') ?? '').split(/\s+/);
        return INLINE_PARAMS
            .filter(inlineParam => requestData.has(inlineParamRequestName(inlineParam)))
            .map(inlineParam => `${inlineParam}:${requestData.get(inlineParamRequestName(inlineParam))}`)
            .filter(term => queryTerms.includes(term));
    }

    /**
     * Requests only the spellchecked query (no results), for searches whose own API
     * doesn't spellcheck (e.g. image search).
     *
     * @param {URLSearchParams} requestData - Search request parameters
     * @param {Function} callback - Callback function(suggestion), with the original query if there is no suggestion
     */
    suggest(requestData, callback) {
        const query = requestData.get('q');
        if (!this.spellcheckEnabled) {
            process.nextTick(() => callback(query));
            return;
        }
        const spellcheckRequestData = this.withSpellcheck(requestData);
        spellcheckRequestData.set('offset', 0);
        spellcheckRequestData.set('maxItems', 0);
        this.get(spellcheckRequestData, (apiData) => callback(this.getSuggestion(apiData, requestData)));
    }

    sanitizeRequestData(requestData) {
        const apiRequestData = new URLSearchParams(requestData);

        INLINE_PARAMS.forEach(inlineParam => {
            const requestParam = inlineParamRequestName(inlineParam);
            if (apiRequestData.has(requestParam)) {
                const regex = new RegExp(String.raw`\s*${inlineParam}:${apiRequestData.get(requestParam)}\s*`)
                apiRequestData.set('q', apiRequestData.get('q').split(regex).join(' '));
            }
        });
        return super.sanitizeRequestData(apiRequestData);
    }
}

module.exports = PageSearchApiRequest;