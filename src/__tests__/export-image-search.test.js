const exportImageSearch = require('../export-image-search');

describe('Image Search Export', () => {
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
            responseItems: [
                {
                    imgTstamp: '20200315120000',
                    imgHeight: '600',
                    imgWidth: '800',
                    imgSrc: 'http://example.com/image.jpg',
                    imgLinkToArchive: 'http://arquivo.pt/wayback/20200315120000/http://example.com/image.jpg',
                    collection: 'test-collection',
                    imgMimeType: 'image/jpeg',
                    imgAlt: 'Test image alt text',
                    imgTitle: 'Test Image',
                    pageTstamp: '20200315120000',
                    pageURL: 'http://example.com/page.html',
                    pageLinkToArchive: 'http://arquivo.pt/wayback/20200315120000/http://example.com/page.html',
                    pageTitle: 'Test Page'
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
                'exports.imgTstamp': 'Image Timestamp',
                'exports.imgHeight': 'Height',
                'exports.imgWidth': 'Width',
                'exports.imgSrc': 'Image URL',
                'exports.imgLinkToArchive': 'Image Archive Link',
                'exports.collection': 'Collection',
                'exports.imgMimeType': 'Image Type',
                'exports.imgAlt': 'Alt Text',
                'exports.imgTitle': 'Image Title',
                'exports.pageTstamp': 'Page Timestamp',
                'exports.pageURL': 'Page URL',
                'exports.pageLinkToArchive': 'Page Archive Link',
                'exports.pageTitle': 'Page Title',
                'common.months.03': 'March'
            };
            return translations[key] || key;
        });
    });

    it('should export image search results with correct fields', () => {
        const result = exportImageSearch(apiRequestData, apiReplyData, translateFunction);

        // Should have data row with all image search fields
        expect(result.length).toBeGreaterThan(10);
        
        // Check last row has image data
        const dataRow = result.at(-1);
        expect(dataRow).toContain(2020); // year
        expect(dataRow).toContain('March'); // month
        expect(dataRow).toContain(15); // day
        expect(dataRow).toContain('20200315120000'); // imgTstamp
        expect(dataRow).toContain('http://example.com/image.jpg'); // imgSrc
    });

    it('should use imgTstamp field for date extraction', () => {
        const result = exportImageSearch(apiRequestData, apiReplyData, translateFunction);

        const dataRow = result[result.length - 1];
        expect(dataRow[0]).toBe(2020); // year from imgTstamp
        expect(dataRow[1]).toBe('March'); // month from imgTstamp
        expect(dataRow[2]).toBe(15); // day from imgTstamp
    });

    it('should include all image-specific fields', () => {
        const result = exportImageSearch(apiRequestData, apiReplyData, translateFunction);

        const dataRow = result[result.length - 1];
        expect(dataRow).toContain('600'); // imgHeight
        expect(dataRow).toContain('800'); // imgWidth
        expect(dataRow).toContain('http://example.com/image.jpg'); // imgSrc
        expect(dataRow).toContain('http://arquivo.pt/wayback/20200315120000/http://example.com/image.jpg'); // imgLinkToArchive
        expect(dataRow).toContain('test-collection');
        expect(dataRow).toContain('image/jpeg'); // imgMimeType
        expect(dataRow).toContain('Test image alt text'); // imgAlt
        expect(dataRow).toContain('Test Image'); // imgTitle
    });

    it('should include page information fields', () => {
        const result = exportImageSearch(apiRequestData, apiReplyData, translateFunction);

        const dataRow = result[result.length - 1];
        expect(dataRow).toContain('20200315120000'); // pageTstamp
        expect(dataRow).toContain('http://example.com/page.html'); // pageURL
        expect(dataRow).toContain('http://arquivo.pt/wayback/20200315120000/http://example.com/page.html'); // pageLinkToArchive
        expect(dataRow).toContain('Test Page'); // pageTitle
    });

    it('should handle multiple image results', () => {
        apiReplyData.responseItems = [
            {
                imgTstamp: '20200101120000',
                imgHeight: '100',
                imgWidth: '200',
                imgSrc: 'http://first.com/img1.jpg',
                imgLinkToArchive: 'http://archive1',
                collection: 'col1',
                imgMimeType: 'image/jpeg',
                imgAlt: 'First alt',
                imgTitle: 'First',
                pageTstamp: '20200101120000',
                pageURL: 'http://first.com',
                pageLinkToArchive: 'http://page-archive1',
                pageTitle: 'First Page'
            },
            {
                imgTstamp: '20200202120000',
                imgHeight: '300',
                imgWidth: '400',
                imgSrc: 'http://second.com/img2.png',
                imgLinkToArchive: 'http://archive2',
                collection: 'col2',
                imgMimeType: 'image/png',
                imgAlt: 'Second alt',
                imgTitle: 'Second',
                pageTstamp: '20200202120000',
                pageURL: 'http://second.com',
                pageLinkToArchive: 'http://page-archive2',
                pageTitle: 'Second Page'
            }
        ];

        const result = exportImageSearch(apiRequestData, apiReplyData, translateFunction);

        // Should have 2 data rows
        const firstDataRow = result.at(-2);
        const secondDataRow = result.at(-1);

        expect(firstDataRow).toContain('http://first.com/img1.jpg');
        expect(secondDataRow).toContain('http://second.com/img2.png');
        expect(firstDataRow).toContain('image/jpeg');
        expect(secondDataRow).toContain('image/png');
    });

    it('should handle empty responseItems', () => {
        apiReplyData.responseItems = [];

        const result = exportImageSearch(apiRequestData, apiReplyData, translateFunction);

        // Should have headers but no data rows
        expect(result.length).toBeGreaterThan(0);
        expect(result.some(row => Array.isArray(row) && row[0] === 'Results')).toBe(true);
    });

    it('should translate field names correctly', () => {
        exportImageSearch(apiRequestData, apiReplyData, translateFunction);

        expect(translateFunction).toHaveBeenCalledWith('exports.year');
        expect(translateFunction).toHaveBeenCalledWith('exports.month');
        expect(translateFunction).toHaveBeenCalledWith('exports.day');
        expect(translateFunction).toHaveBeenCalledWith('exports.imgTstamp');
        expect(translateFunction).toHaveBeenCalledWith('exports.imgHeight');
        expect(translateFunction).toHaveBeenCalledWith('exports.imgWidth');
        expect(translateFunction).toHaveBeenCalledWith('exports.imgSrc');
        expect(translateFunction).toHaveBeenCalledWith('exports.imgLinkToArchive');
        expect(translateFunction).toHaveBeenCalledWith('exports.imgMimeType');
        expect(translateFunction).toHaveBeenCalledWith('exports.imgAlt');
        expect(translateFunction).toHaveBeenCalledWith('exports.imgTitle');
        expect(translateFunction).toHaveBeenCalledWith('exports.pageTstamp');
        expect(translateFunction).toHaveBeenCalledWith('exports.pageURL');
        expect(translateFunction).toHaveBeenCalledWith('exports.pageLinkToArchive');
        expect(translateFunction).toHaveBeenCalledWith('exports.pageTitle');
    });

    it('should handle different image dimensions', () => {
        apiReplyData.responseItems[0].imgHeight = '1080';
        apiReplyData.responseItems[0].imgWidth = '1920';

        const result = exportImageSearch(apiRequestData, apiReplyData, translateFunction);

        const dataRow = result.at(-1);
        expect(dataRow).toContain('1080');
        expect(dataRow).toContain('1920');
    });
});
