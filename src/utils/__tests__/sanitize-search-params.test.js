const sanitizeSearchParams = require('../sanitize-search-params');

// Config is automatically mocked via __mocks__/config.js

describe('sanitizeSearchParams', () => {
    let mockReq;
    let mockRes;

    beforeEach(() => {
        mockReq = { query: {} };
        mockRes = {};
    });

    describe('Parameter transformation', () => {
        it('should transform dateStart to from parameter', () => {
            mockReq.query = { dateStart: '01/01/2020' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.get('from')).toBe('20200101');
            expect(result.has('dateStart')).toBe(false);
        });

        it('should transform ion-dt-0 to from parameter', () => {
            mockReq.query = { 'ion-dt-0': '2020-01-01' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.get('from')).toBe('20200101');
            expect(result.has('ion-dt-0')).toBe(false);
        });

        it('should transform dateEnd to to parameter', () => {
            mockReq.query = { dateEnd: '31/12/2020' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.get('to')).toBe('20201231');
            expect(result.has('dateEnd')).toBe(false);
        });

        it('should transform ion-dt-1 to to parameter', () => {
            mockReq.query = { 'ion-dt-1': '2020-12-31' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.get('to')).toBe('20201231');
            expect(result.has('ion-dt-1')).toBe(false);
        });

        it('should transform query to q parameter', () => {
            mockReq.query = { query: 'test search' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.get('q')).toBe('test search');
            expect(result.has('query')).toBe(false);
        });

        it('should transform start to offset parameter', () => {
            mockReq.query = { start: '20' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.get('offset')).toBe('20');
            expect(result.has('start')).toBe(false);
        });

        it('should transform format to type parameter', () => {
            mockReq.query = { format: 'pdf' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.get('type')).toBe('pdf');
            expect(result.has('format')).toBe(false);
        });

        it('should transform adv_mime to type parameter', () => {
            mockReq.query = { adv_mime: 'image/jpeg' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.get('type')).toBe('image/jpeg');
            expect(result.has('adv_mime')).toBe(false);
        });

        it('should transform hitsPerPage to maxItems parameter', () => {
            mockReq.query = { hitsPerPage: '50' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.get('maxItems')).toBe('50');
            expect(result.has('hitsPerPage')).toBe(false);
        });

        it('should transform site to siteSearch and remove spaces', () => {
            mockReq.query = { site: 'example.com test.com' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.get('siteSearch')).toBe('example.comtest.com');
            expect(result.has('site')).toBe(false);
        });

        it('should transform hitsPerDup to dedupValue parameter', () => {
            mockReq.query = { hitsPerDup: '5' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.get('dedupValue')).toBe('5');
            expect(result.has('hitsPerDup')).toBe(false);
        });

        it('should not overwrite existing new parameter', () => {
            mockReq.query = { query: 'old', q: 'new' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.get('q')).toBe('new');
            expect(result.has('query')).toBe(true);
        });
    });

    describe('Default parameters', () => {
        it('should add default from date if not provided', () => {
            mockReq.query = { q: 'test' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.get('from')).toBe('19910806'); // From mock config
        });

        it('should add default to date (today) if not provided', () => {
            mockReq.query = { q: 'test' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            const today = new Date().toLocaleDateString('en-CA').split('-').join('');
            expect(result.get('to')).toBe(today);
        });

        it('should enforce minimum from date', () => {
            mockReq.query = { from: '19900101', q: 'test' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.get('from')).toBe('19910806'); // From mock config
        });

        it('should enforce maximum to date (today)', () => {
            mockReq.query = { to: '20991231', q: 'test' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            const today = new Date().toLocaleDateString('en-CA').split('-').join('');
            expect(result.get('to')).toBe(today);
        });

        it('should not modify valid from date within range', () => {
            mockReq.query = { from: '20200101', q: 'test' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.get('from')).toBe('20200101');
        });
    });

    describe('Empty field cleaning', () => {
        it('should remove empty string parameters', () => {
            mockReq.query = { q: 'test', empty: '', another: '  ' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.has('empty')).toBe(false);
            expect(result.has('another')).toBe(false);
            expect(result.get('q')).toBe('test');
        });
    });

    describe('Query parsing - exact phrases', () => {
        it('should extract exact phrase to adv_phr', () => {
            mockReq.query = { q: 'test "exact phrase" search' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.get('adv_phr')).toBe('exact phrase');
            expect(result.get('adv_and')).toBe('test  search');
        });

        it('should extract only last phrase to adv_phr', () => {
            mockReq.query = { q: '"first phrase" test "last phrase"' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.get('adv_phr')).toBe('last phrase');
            expect(result.get('adv_and')).toContain('"first phrase"');
        });
    });

    describe('Query parsing - exclusion terms', () => {
        it('should extract exclusion terms to adv_not', () => {
            mockReq.query = { q: 'test -exclude -another' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.get('adv_not')).toBe('exclude another');
            expect(result.get('adv_and')).toBe('test');
        });

        it('should handle exclusion terms at beginning', () => {
            mockReq.query = { q: '-exclude test' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.get('adv_not')).toBe('exclude');
            expect(result.get('adv_and')).toBe('test');
        });
    });

    describe('Query parsing - special terms', () => {
        it('should extract site: term to siteSearch parameter', () => {
            mockReq.query = { q: 'test site:example.com search' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.get('siteSearch')).toBe('example.com');
            expect(result.get('adv_and')).toBe('test search');
        });

        it('should extract type: term to type parameter', () => {
            mockReq.query = { q: 'test type:pdf' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.get('type')).toBe('pdf');
            expect(result.get('adv_and')).toBe('test');
        });

        it('should extract collection: term to collection parameter', () => {
            mockReq.query = { q: 'test collection:myCollection' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.get('collection')).toBe('myCollection');
            expect(result.get('adv_and')).toBe('test');
        });

        it('should extract safe: term to safeSearch parameter', () => {
            mockReq.query = { q: 'test safe:off' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.get('safeSearch')).toBe('off');
            expect(result.get('adv_and')).toBe('test');
        });

        it('should extract size: term to size parameter', () => {
            mockReq.query = { q: 'test size:large' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.get('size')).toBe('large');
            expect(result.get('adv_and')).toBe('test');
        });

        it('should not overwrite existing parameter with inline term', () => {
            mockReq.query = { q: 'test site:example.com', siteSearch: 'existing.com' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.get('siteSearch')).toBe('existing.com');
        });
    });

    describe('Default value removal', () => {
        it('should remove type parameter if value is "all"', () => {
            mockReq.query = { q: 'test', type: 'all' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.has('type')).toBe(false);
        });

        it('should remove size parameter if value is "all"', () => {
            mockReq.query = { q: 'test', size: 'all' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.has('size')).toBe(false);
        });

        it('should remove safeSearch parameter if value is "on"', () => {
            mockReq.query = { q: 'test', safeSearch: 'on' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.has('safeSearch')).toBe(false);
        });
    });

    describe('Query reconstruction from advanced search params', () => {
        it('should reconstruct query from adv_and', () => {
            mockReq.query = { adv_and: 'test search' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.get('q')).toBe('test search');
        });

        it('should reconstruct query with exact phrase', () => {
            mockReq.query = { adv_and: 'test', adv_phr: 'exact phrase' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.get('q')).toBe('test "exact phrase"');
        });

        it('should reconstruct query with exclusion terms', () => {
            mockReq.query = { adv_and: 'test', adv_not: 'exclude another' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.get('q')).toBe('test -exclude -another');
        });

        it('should reconstruct query with site parameter', () => {
            mockReq.query = { adv_and: 'test', siteSearch: 'example.com' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.get('q')).toBe('test site:example.com');
        });

        it('should reconstruct query with type parameter', () => {
            mockReq.query = { adv_and: 'test', type: 'pdf' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.get('q')).toBe('test type:pdf');
        });

        it('should reconstruct query with collection parameter', () => {
            mockReq.query = { adv_and: 'test', collection: 'myCol' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.get('q')).toBe('test collection:myCol');
        });

        it('should reconstruct query with multiple parameters', () => {
            mockReq.query = { 
                adv_and: 'test', 
                adv_phr: 'exact phrase',
                adv_not: 'exclude',
                siteSearch: 'example.com',
                type: 'pdf'
            };
            const result = sanitizeSearchParams(mockReq, mockRes);
            const query = result.get('q');
            expect(query).toContain('test');
            expect(query).toContain('"exact phrase"');
            expect(query).toContain('-exclude');
            expect(query).toContain('site:example.com');
            expect(query).toContain('type:pdf');
        });
    });

    describe('Complex query scenarios', () => {
        it('should handle combination of phrases, exclusions, and special terms', () => {
            mockReq.query = { q: '"exact phrase" test -exclude site:example.com type:pdf' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result.get('adv_phr')).toBe('exact phrase');
            expect(result.get('adv_not')).toBe('exclude');
            expect(result.get('siteSearch')).toBe('example.com');
            expect(result.get('type')).toBe('pdf');
            expect(result.get('adv_and')).toBe('test');
        });

        it('should return URLSearchParams instance', () => {
            mockReq.query = { q: 'test' };
            const result = sanitizeSearchParams(mockReq, mockRes);
            expect(result).toBeInstanceOf(URLSearchParams);
        });
    });
});
