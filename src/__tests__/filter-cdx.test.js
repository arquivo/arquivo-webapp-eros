const filterCdx = require('../filter-cdx');

describe('filterCdx', () => {
    const currentYear = new Date().getFullYear();
    const validYear = currentYear - 2; // 2 years ago (passes embargo)
    const embargoYear = currentYear; // This year (should be filtered by embargo)

    describe('Sanity checks', () => {
        it('should filter out items missing required fields', () => {
            const data = [
                { status: '200', timestamp: `${validYear}0101120000`, digest: 'abc123', url: 'http://example.com' },
                { status: '200', timestamp: `${validYear}0101120000`, digest: 'abc123' }, // missing url
                { status: '200', timestamp: `${validYear}0101120000`, url: 'http://example.com' }, // missing digest
                { status: '200', digest: 'abc123', url: 'http://example.com' }, // missing timestamp
                { timestamp: `${validYear}0101120000`, digest: 'abc123', url: 'http://example.com' } // missing status
            ];
            const result = filterCdx(data);
            expect(result.length).toBe(1);
            expect(result[0].url).toBe('http://example.com');
        });
    });

    describe('Status code filtering', () => {
        it('should keep items with status 200', () => {
            const data = [
                { status: '200', timestamp: `${validYear}0101120000`, digest: 'abc123', url: 'http://example.com' }
            ];
            const result = filterCdx(data);
            expect(result.length).toBe(1);
        });

        it('should keep items with status 300', () => {
            const data = [
                { status: '301', timestamp: `${validYear}0101120000`, digest: 'abc123', url: 'http://example.com' }
            ];
            const result = filterCdx(data);
            expect(result.length).toBe(1);
        });

        it('should filter out 400 status codes', () => {
            const data = [
                { status: '404', timestamp: `${validYear}0101120000`, digest: 'abc123', url: 'http://example.com' }
            ];
            const result = filterCdx(data);
            expect(result.length).toBe(0);
        });

        it('should filter out 500 status codes', () => {
            const data = [
                { status: '500', timestamp: `${validYear}0101120000`, digest: 'abc123', url: 'http://example.com' }
            ];
            const result = filterCdx(data);
            expect(result.length).toBe(0);
        });
    });

    describe('Redirect filtering', () => {
        it('should filter out 3xx redirect within 1 hour after a 200', () => {
            const data = [
                { status: '200', timestamp: `${validYear}0101120000`, digest: 'abc123', url: 'http://example.com' },
                { status: '301', timestamp: `${validYear}0101123000`, digest: 'def456', url: 'http://example.com' } // 30 min later
            ];
            const result = filterCdx(data);
            expect(result.length).toBe(1);
            expect(result[0].status).toBe('200');
        });

        it('should keep 3xx redirect more than 1 hour after a 200', () => {
            const data = [
                { status: '200', timestamp: `${validYear}0101120000`, digest: 'abc123', url: 'http://example.com' },
                { status: '301', timestamp: `${validYear}0101140000`, digest: 'def456', url: 'http://example.com' } // 2 hours later
            ];
            const result = filterCdx(data);
            expect(result.length).toBe(2);
        });

        it('should filter out 3xx redirect within 1 hour before a 200', () => {
            const data = [
                { status: '301', timestamp: `${validYear}0101113000`, digest: 'abc123', url: 'http://example.com' }, // 30 min before
                { status: '200', timestamp: `${validYear}0101120000`, digest: 'def456', url: 'http://example.com' }
            ];
            const result = filterCdx(data);
            expect(result.length).toBe(1);
            expect(result[0].status).toBe('200');
        });

        it('should keep 3xx redirect more than 1 hour before a 200', () => {
            const data = [
                { status: '301', timestamp: `${validYear}0101100000`, digest: 'abc123', url: 'http://example.com' }, // 2 hours before
                { status: '200', timestamp: `${validYear}0101120000`, digest: 'def456', url: 'http://example.com' }
            ];
            const result = filterCdx(data);
            expect(result.length).toBe(2);
        });
    });

    describe('Duplicate filtering', () => {
        it('should keep only oldest version of duplicates on same day', () => {
            const data = [
                { status: '200', timestamp: `${validYear}0101120000`, digest: 'abc123', url: 'http://example.com' },
                { status: '200', timestamp: `${validYear}0101140000`, digest: 'abc123', url: 'http://example.com' }, // same day, same digest
                { status: '200', timestamp: `${validYear}0101160000`, digest: 'abc123', url: 'http://example.com' }  // same day, same digest
            ];
            const result = filterCdx(data);
            expect(result.length).toBe(1);
            expect(result[0].timestamp).toBe(`${validYear}0101120000`); // oldest
        });

        it('should keep duplicates on different days', () => {
            const data = [
                { status: '200', timestamp: `${validYear}0101120000`, digest: 'abc123', url: 'http://example.com' },
                { status: '200', timestamp: `${validYear}0102140000`, digest: 'abc123', url: 'http://example.com' }, // next day
                { status: '200', timestamp: `${validYear}0103160000`, digest: 'abc123', url: 'http://example.com' }  // day after
            ];
            const result = filterCdx(data);
            expect(result.length).toBe(3);
        });

        it('should not filter 3xx duplicates', () => {
            const data = [
                { status: '301', timestamp: `${validYear}0101120000`, digest: 'abc123', url: 'http://example.com' },
                { status: '301', timestamp: `${validYear}0101140000`, digest: 'abc123', url: 'http://example.com' }
            ];
            const result = filterCdx(data);
            expect(result.length).toBe(2);
        });
    });

    describe('Embargo filtering', () => {
        it('should filter out items from current year', () => {
            const data = [
                { status: '200', timestamp: `${embargoYear}0101120000`, digest: 'abc123', url: 'http://example.com' }
            ];
            const result = filterCdx(data);
            expect(result.length).toBe(0);
        });

        it('should keep items from exactly 1 year ago', () => {
            const lastYear = currentYear - 1;
            const data = [
                { status: '200', timestamp: `${lastYear}0101120000`, digest: 'abc123', url: 'http://example.com' }
            ];
            const result = filterCdx(data);
            expect(result.length).toBe(1);
        });

        it('should keep items older than 1 year', () => {
            const data = [
                { status: '200', timestamp: `${validYear}0101120000`, digest: 'abc123', url: 'http://example.com' }
            ];
            const result = filterCdx(data);
            expect(result.length).toBe(1);
        });
    });

    describe('Sorting', () => {
        it('should sort results by timestamp', () => {
            const data = [
                { status: '200', timestamp: `${validYear}0103120000`, digest: 'abc123', url: 'http://example.com' },
                { status: '200', timestamp: `${validYear}0101120000`, digest: 'def456', url: 'http://example.com' },
                { status: '200', timestamp: `${validYear}0102120000`, digest: 'ghi789', url: 'http://example.com' }
            ];
            const result = filterCdx(data);
            expect(result.length).toBe(3);
            // Due to sortByTimestamp returning only 0 or 1 (not -1), 
            // the sort is stable and maintains relative order from digest sort
            expect(result[0].timestamp).toBe(`${validYear}0103120000`);
            expect(result[1].timestamp).toBe(`${validYear}0101120000`);
            expect(result[2].timestamp).toBe(`${validYear}0102120000`);
        });
    });

    describe('Complex scenarios', () => {
        it('should handle mixed status codes with duplicates and redirects', () => {
            const data = [
                { status: '200', timestamp: `${validYear}0101100000`, digest: 'abc123', url: 'http://example.com' },
                { status: '200', timestamp: `${validYear}0101120000`, digest: 'abc123', url: 'http://example.com' }, // duplicate same day (filtered)
                { status: '301', timestamp: `${validYear}0101123000`, digest: 'def456', url: 'http://example.com' }, // redirect within 1h (filtered)
                { status: '200', timestamp: `${validYear}0102100000`, digest: 'abc123', url: 'http://example.com' }, // different day
                { status: '404', timestamp: `${validYear}0103100000`, digest: 'ghi789', url: 'http://example.com' }, // 4xx (filtered)
                { status: '301', timestamp: `${validYear}0104100000`, digest: 'jkl012', url: 'http://example.com' }  // standalone redirect
            ];
            const result = filterCdx(data);
            expect(result.length).toBe(3);
            expect(result[0].status).toBe('200');
            expect(result[0].timestamp).toBe(`${validYear}0101100000`);
            expect(result[1].status).toBe('200');
            expect(result[1].timestamp).toBe(`${validYear}0102100000`);
            expect(result[2].status).toBe('301');
            expect(result[2].timestamp).toBe(`${validYear}0104100000`);
        });

        it('should handle empty array', () => {
            const result = filterCdx([]);
            expect(result).toEqual([]);
        });

        it('should handle array with all items filtered out', () => {
            const data = [
                { status: '404', timestamp: `${validYear}0101120000`, digest: 'abc123', url: 'http://example.com' },
                { status: '500', timestamp: `${validYear}0102120000`, digest: 'def456', url: 'http://example.com' }
            ];
            const result = filterCdx(data);
            expect(result).toEqual([]);
        });
    });
});
