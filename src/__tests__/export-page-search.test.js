const exportPageSearch = require('../export-page-search');

describe('Page Search Export', () => {
    let apiRequestData;
    let apiReplyData;
    let translateFunction;

    beforeEach(() => {
        apiRequestData = new URLSearchParams({
            q: 'test query',
            from: '20200101',
            to: '20201231'
        });

        apiReplyData = {
            response_items: [
                {
                    tstamp: '20200315120000',
                    originalURL: 'http://example.com',
                    linkToArchive: 'http://arquivo.pt/wayback/20200315120000/http://example.com',
                    linkToScreenshot: 'http://arquivo.pt/screenshot/20200315120000/http://example.com',
                    linkToExtractedText: 'http://arquivo.pt/text/20200315120000/http://example.com',
                    collection: 'test-collection',
                    mimeType: 'text/html',
                    title: 'Test Page',
                    snippet: 'This is a test snippet'
                }
            ]
        };

        translateFunction = jest.fn((key) => {
            const translations = {
                'exports.queryArgument': 'Query Argument',
                'exports.query': 'Query',
                'exports.results': 'Results',
                'exports.year': 'Year',
                'exports.month': 'Month',
                'exports.day': 'Day',
                'exports.tstamp': 'Timestamp',
                'exports.originalURL': 'Original URL',
                'exports.linkToArchive': 'Archive Link',
                'exports.linkToScreenshot': 'Screenshot',
                'exports.linkToExtractedText': 'Extracted Text',
                'exports.collection': 'Collection',
                'exports.mimeType': 'MIME Type',
                'exports.title': 'Title',
                'exports.snippet': 'Snippet',
                'common.months.03': 'March'
            };
            return translations[key] || key;
        });
    });

    it('should export page search results with correct fields', () => {
        const result = exportPageSearch(apiRequestData, apiReplyData, translateFunction);

        // Should have data row with all page search fields
        expect(result.length).toBeGreaterThan(10);
        
        // Check last row has page data
        const dataRow = result.at(-1);
        expect(dataRow).toContain(2020); // year
        expect(dataRow).toContain('March'); // month
        expect(dataRow).toContain(15); // day
        expect(dataRow).toContain('20200315120000'); // tstamp
        expect(dataRow).toContain('http://example.com'); // originalURL
    });

    it('should use tstamp field for date extraction', () => {
        const result = exportPageSearch(apiRequestData, apiReplyData, translateFunction);

        const dataRow = result.at(-1);
        expect(dataRow[0]).toBe(2020); // year from tstamp
        expect(dataRow[1]).toBe('March'); // month from tstamp
        expect(dataRow[2]).toBe(15); // day from tstamp
    });

    it('should include all page-specific fields', () => {
        const result = exportPageSearch(apiRequestData, apiReplyData, translateFunction);

        const dataRow = result.at(-1);
        expect(dataRow).toContain('http://arquivo.pt/wayback/20200315120000/http://example.com');
        expect(dataRow).toContain('http://arquivo.pt/screenshot/20200315120000/http://example.com');
        expect(dataRow).toContain('http://arquivo.pt/text/20200315120000/http://example.com');
        expect(dataRow).toContain('test-collection');
        expect(dataRow).toContain('text/html');
        expect(dataRow).toContain('Test Page');
        expect(dataRow).toContain('This is a test snippet');
    });

    it('should handle multiple page results', () => {
        apiReplyData.response_items = [
            {
                tstamp: '20200101120000',
                originalURL: 'http://first.com',
                linkToArchive: 'http://archive1',
                linkToScreenshot: 'http://screenshot1',
                linkToExtractedText: 'http://text1',
                collection: 'col1',
                mimeType: 'text/html',
                title: 'First',
                snippet: 'First snippet'
            },
            {
                tstamp: '20200202120000',
                originalURL: 'http://second.com',
                linkToArchive: 'http://archive2',
                linkToScreenshot: 'http://screenshot2',
                linkToExtractedText: 'http://text2',
                collection: 'col2',
                mimeType: 'application/pdf',
                title: 'Second',
                snippet: 'Second snippet'
            }
        ];

        const result = exportPageSearch(apiRequestData, apiReplyData, translateFunction);

        // Should have 2 data rows
        const firstDataRow = result.at(-2);
        const secondDataRow = result.at(-1);

        expect(firstDataRow).toContain('http://first.com');
        expect(secondDataRow).toContain('http://second.com');
    });

    it('should handle empty response_items', () => {
        apiReplyData.response_items = [];

        const result = exportPageSearch(apiRequestData, apiReplyData, translateFunction);

        // Should have headers but no data rows
        expect(result.length).toBeGreaterThan(0);
        expect(result.some(row => Array.isArray(row) && row[0] === 'Results')).toBe(true);
    });

    it('should translate field names correctly', () => {
        exportPageSearch(apiRequestData, apiReplyData, translateFunction);

        expect(translateFunction).toHaveBeenCalledWith('exports.year');
        expect(translateFunction).toHaveBeenCalledWith('exports.month');
        expect(translateFunction).toHaveBeenCalledWith('exports.day');
        expect(translateFunction).toHaveBeenCalledWith('exports.tstamp');
        expect(translateFunction).toHaveBeenCalledWith('exports.originalURL');
        expect(translateFunction).toHaveBeenCalledWith('exports.linkToArchive');
        expect(translateFunction).toHaveBeenCalledWith('exports.title');
        expect(translateFunction).toHaveBeenCalledWith('exports.snippet');
    });
});
