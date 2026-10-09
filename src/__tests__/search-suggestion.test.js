'use strict';

const ejs = require('ejs');
const path = require('path');

/**
 * "Did you mean" link (views/templates/fragments/search-suggestion.ejs), rendered
 * directly and through the no-results page (views/templates/body/body-not-found.ejs).
 */
describe('search suggestion link', () => {
    const VIEWS = path.join(__dirname, '../../views');
    const FRAGMENT = path.join(VIEWS, 'templates/fragments/search-suggestion.ejs');
    const NOT_FOUND = path.join(VIEWS, 'templates/body/body-not-found.ejs');
    const t = (key) => key;

    const render = (template, data) => ejs.renderFile(template, { t, ...data }, { views: [VIEWS] });

    function suggestionHref(html) {
        const href = html.match(/<p id="term-suggested"[^]*?<a href="([^"]*)"/)[1];
        return new URL(href.replace(/&amp;/g, '&'), 'http://localhost');
    }

    const requestData = new URLSearchParams({
        q: 'Ronaldi collection:Roteiro',
        l: 'pt',
        from: '19910806',
        to: '20261010',
        offset: '20',
        collection: 'Roteiro',
        adv_and: 'Ronaldi',
        trackingId: 'abc',
    });

    it('links to the suggested search with a real URL, not javascript:', async () => {
        const html = await render(FRAGMENT, { suggestion: 'ronaldo collection:Roteiro', requestData });

        expect(html).not.toContain('javascript:');
        expect(suggestionHref(html).pathname).toBe('/page/search');
    });

    it('keeps the search filters and replaces the query with the suggestion', async () => {
        const params = suggestionHref(await render(FRAGMENT, { suggestion: 'ronaldo collection:Roteiro', requestData })).searchParams;

        expect(params.get('q')).toBe('ronaldo collection:Roteiro');
        expect(params.get('collection')).toBe('Roteiro');
        expect(params.get('l')).toBe('pt');
        expect(params.get('from')).toBe('19910806');
        expect(params.get('to')).toBe('20261010');
        expect(params.get('spellchecked')).toBe('true');
    });

    it('starts the suggested search on its first page, without stale derived or tracking params', async () => {
        const params = suggestionHref(await render(FRAGMENT, { suggestion: 'ronaldo collection:Roteiro', requestData })).searchParams;

        expect(params.has('offset')).toBe(false);
        expect(params.has('adv_and')).toBe(false);
        expect(params.has('trackingId')).toBe(false);
    });

    it('links to the same search type', async () => {
        const html = await render(FRAGMENT, { suggestion: 'lisboa', suggestionType: 'image', requestData });

        expect(suggestionHref(html).pathname).toBe('/image/search');
    });

    it('links image searches without results to image search', async () => {
        const html = await render(NOT_FOUND, {
            query: 'Lizboa size:lg',
            suggestion: 'lisboa size:lg',
            searchType: 'image-search',
            requestData: new URLSearchParams({ q: 'Lizboa size:lg', size: 'lg' }),
        });

        expect(suggestionHref(html).pathname).toBe('/image/search');
        expect(suggestionHref(html).searchParams.get('q')).toBe('lisboa size:lg');
    });

    it('escapes the suggestion', async () => {
        const ATTR_BREAK = '"><script>alert(1)</script>';
        const html = await render(FRAGMENT, { suggestion: ATTR_BREAK, requestData });

        expect(html).not.toContain(ATTR_BREAK);
        expect(suggestionHref(html).searchParams.get('q')).toBe(ATTR_BREAK);
    });
});
