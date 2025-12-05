const exportResults = require('../export-results');

describe('Export Results Utility', () => {
    let apiRequestData;
    let translateFunction;

    beforeEach(() => {
        // Setup mock request data
        apiRequestData = new URLSearchParams({
            q: 'test query',
            from: '20200101',
            to: '20201231',
            offset: '0',
            maxItems: '50',
            siteSearch: 'example.com',
            type: 'all',
            collection: 'test-collection'
        });

        // Setup mock translate function
        translateFunction = jest.fn((key) => {
            const translations = {
                'exports.queryArgument': 'Query Argument',
                'exports.queryValue': 'Query Value',
                'exports.query': 'Query',
                'exports.from': 'From',
                'exports.to': 'To',
                'exports.offset': 'Offset',
                'exports.maxItems': 'Max Items',
                'exports.siteSearch': 'Site Search',
                'exports.type': 'Type',
                'exports.collection': 'Collection',
                'exports.results': 'Results',
                'exports.tstamp': 'Timestamp',
                'exports.title': 'Title',
                'exports.url': 'URL',
                'common.months.01': 'January',
                'common.months.03': 'March',
                'common.months.12': 'December'
            };
            return translations[key] || key;
        });
    });

    describe('Basic Structure', () => {
        it('should create export with query parameters section', () => {
            const result = exportResults(apiRequestData, [], translateFunction, 'tstamp', ['title']);

            expect(result[0]).toEqual(['Query Argument', 'Query Value']);
            expect(result[1]).toEqual(['Query', 'test query']);
            expect(result[2]).toEqual(['From', '20200101']);
            expect(result[3]).toEqual(['To', '20201231']);
        });

        it('should include all request parameters', () => {
            const result = exportResults(apiRequestData, [], translateFunction, 'tstamp', ['title']);

            expect(result[4]).toEqual(['Offset', '0']);
            expect(result[5]).toEqual(['Max Items', '50']);
            expect(result[6]).toEqual(['Site Search', 'example.com']);
            expect(result[7]).toEqual(['Type', 'all']);
            expect(result[8]).toEqual(['Collection', 'test-collection']);
        });

        it('should add empty line after parameters', () => {
            const result = exportResults(apiRequestData, [], translateFunction, 'tstamp', ['title']);

            expect(result[9]).toEqual([]);
        });

        it('should add results header', () => {
            const result = exportResults(apiRequestData, [], translateFunction, 'tstamp', ['title']);

            expect(result[10]).toEqual(['Results']);
        });

        it('should add column headers based on displayFields', () => {
            const result = exportResults(apiRequestData, [], translateFunction, 'tstamp', ['title', 'url']);

            // Headers are translated with 'exports.' prefix
            expect(translateFunction).toHaveBeenCalledWith('exports.title');
            expect(translateFunction).toHaveBeenCalledWith('exports.url');
        });
    });

    describe('Data Processing', () => {
        it('should process single result item', () => {
            const apiResponseItems = [{
                tstamp: '20200315120000',
                title: 'Test Page',
                url: 'http://example.com'
            }];

            const result = exportResults(apiRequestData, apiResponseItems, translateFunction, 'tstamp', ['title', 'url']);

            expect(result[12]).toEqual(['Test Page', 'http://example.com']);
        });

        it('should extract year from timestamp', () => {
            const apiResponseItems = [{
                tstamp: '20200315120000',
                title: 'Test'
            }];

            const result = exportResults(apiRequestData, apiResponseItems, translateFunction, 'tstamp', ['year', 'title']);

            expect(result[12][0]).toBe(2020);
        });

        it('should extract and translate month from timestamp', () => {
            const apiResponseItems = [{
                tstamp: '20200315120000',
                title: 'Test'
            }];

            const result = exportResults(apiRequestData, apiResponseItems, translateFunction, 'tstamp', ['month', 'title']);

            expect(result[12][0]).toBe('March');
            expect(translateFunction).toHaveBeenCalledWith('common.months.03');
        });

        it('should extract day from timestamp', () => {
            const apiResponseItems = [{
                tstamp: '20200315120000',
                title: 'Test'
            }];

            const result = exportResults(apiRequestData, apiResponseItems, translateFunction, 'tstamp', ['day', 'title']);

            expect(result[12][0]).toBe(15);
        });

        it('should process multiple result items', () => {
            const apiResponseItems = [
                { tstamp: '20200101120000', title: 'First' },
                { tstamp: '20200202120000', title: 'Second' },
                { tstamp: '20200303120000', title: 'Third' }
            ];

            const result = exportResults(apiRequestData, apiResponseItems, translateFunction, 'tstamp', ['title']);

            expect(result[12]).toEqual(['First']);
            expect(result[13]).toEqual(['Second']);
            expect(result[14]).toEqual(['Third']);
        });

        it('should handle different timestamp field names', () => {
            const apiResponseItems = [{
                imgTstamp: '20201225120000',
                title: 'Image'
            }];

            const result = exportResults(apiRequestData, apiResponseItems, translateFunction, 'imgTstamp', ['year', 'month', 'day']);

            expect(result[12][0]).toBe(2020);
            expect(result[12][1]).toBe('December');
            expect(result[12][2]).toBe(25);
        });

        it('should not modify original data', () => {
            const apiResponseItems = [{
                tstamp: '20200315120000',
                title: 'Test'
            }];

            exportResults(apiRequestData, apiResponseItems, translateFunction, 'tstamp', ['year', 'title']);

            // Original data should not have year/month/day fields added
            expect(apiResponseItems[0].year).toBeUndefined();
            expect(apiResponseItems[0].month).toBeUndefined();
            expect(apiResponseItems[0].day).toBeUndefined();
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty response items', () => {
            const result = exportResults(apiRequestData, [], translateFunction, 'tstamp', ['title']);

            // Should still have headers but no data rows
            expect(result.length).toBe(12); // Parameters + empty line + results header + column headers
        });

        it('should handle null response items', () => {
            const result = exportResults(apiRequestData, null, translateFunction, 'tstamp', ['title']);

            expect(result.length).toBe(12);
        });

        it('should handle undefined response items', () => {
            const result = exportResults(apiRequestData, undefined, translateFunction, 'tstamp', ['title']);

            expect(result.length).toBe(12);
        });

        it('should attempt to process undefined items (but may error)', () => {
            const apiResponseItems = [
                { tstamp: '20200101120000', title: 'First' },
                undefined,
                { tstamp: '20200303120000', title: 'Third' }
            ];

            // Due to {...undefined} creating {}, undefined items will cause timestamp error
            expect(() => {
                exportResults(apiRequestData, apiResponseItems, translateFunction, 'tstamp', ['title']);
            }).toThrow();
        });

        it('should handle items with missing timestamp field', () => {
            const apiResponseItems = [
                { tstamp: '20200101120000', title: 'First' },
                { title: 'No timestamp' }, // Missing tstamp field
                { tstamp: '20200303120000', title: 'Third' }
            ];

            // Items without timestamp field will throw error when accessing substring
            expect(() => {
                exportResults(apiRequestData, apiResponseItems, translateFunction, 'tstamp', ['title']);
            }).toThrow();
        });

        it('should handle missing request parameters', () => {
            const minimalRequest = new URLSearchParams({ q: 'test' });

            const result = exportResults(minimalRequest, [], translateFunction, 'tstamp', ['title']);

            expect(result[1]).toEqual(['Query', 'test']);
            expect(result[2][1]).toBeNull(); // from parameter returns null, not undefined
        });

        it('should handle empty displayFields', () => {
            const result = exportResults(apiRequestData, [], translateFunction, 'tstamp', []);

            expect(result[11]).toEqual([]);
        });

        it('should handle many display fields', () => {
            const fields = ['field1', 'field2', 'field3', 'field4', 'field5'];
            const result = exportResults(apiRequestData, [], translateFunction, 'tstamp', fields);

            expect(result[11].length).toBe(5);
        });
    });

    describe('Data Integrity', () => {
        it('should preserve all data fields', () => {
            const apiResponseItems = [{
                tstamp: '20200315120000',
                title: 'Test',
                url: 'http://example.com',
                collection: 'test',
                mimeType: 'text/html'
            }];

            const result = exportResults(
                apiRequestData,
                apiResponseItems,
                translateFunction,
                'tstamp',
                ['title', 'url', 'collection', 'mimeType']
            );

            expect(result[12]).toEqual(['Test', 'http://example.com', 'test', 'text/html']);
        });

        it('should handle special characters in data', () => {
            const apiResponseItems = [{
                tstamp: '20200315120000',
                title: 'Test "quotes" & ampersand',
                url: 'http://example.com?a=1&b=2'
            }];

            const result = exportResults(apiRequestData, apiResponseItems, translateFunction, 'tstamp', ['title', 'url']);

            expect(result[12][0]).toBe('Test "quotes" & ampersand');
            expect(result[12][1]).toBe('http://example.com?a=1&b=2');
        });

        it('should handle unicode characters', () => {
            const apiResponseItems = [{
                tstamp: '20200315120000',
                title: 'Português 日本語 🎉'
            }];

            const result = exportResults(apiRequestData, apiResponseItems, translateFunction, 'tstamp', ['title']);

            expect(result[12][0]).toBe('Português 日本語 🎉');
        });
    });

    describe('Translation Integration', () => {
        it('should translate all parameter labels', () => {
            exportResults(apiRequestData, [], translateFunction, 'tstamp', ['title']);

            expect(translateFunction).toHaveBeenCalledWith('exports.queryArgument');
            expect(translateFunction).toHaveBeenCalledWith('exports.queryValue');
            expect(translateFunction).toHaveBeenCalledWith('exports.query');
            expect(translateFunction).toHaveBeenCalledWith('exports.from');
            expect(translateFunction).toHaveBeenCalledWith('exports.to');
        });

        it('should translate column headers', () => {
            exportResults(apiRequestData, [], translateFunction, 'tstamp', ['title', 'url']);

            expect(translateFunction).toHaveBeenCalledWith('exports.title');
            expect(translateFunction).toHaveBeenCalledWith('exports.url');
        });

        it('should translate month names', () => {
            const apiResponseItems = [{
                tstamp: '20200101120000',
                title: 'Test'
            }];

            exportResults(apiRequestData, apiResponseItems, translateFunction, 'tstamp', ['month']);

            expect(translateFunction).toHaveBeenCalledWith('common.months.01');
        });
    });
});
