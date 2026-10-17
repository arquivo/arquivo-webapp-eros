const filterCdx = require('../filter-cdx');

// Every ordering of the given items
function permutations(items) {
    if (items.length <= 1) return [items];
    return items.flatMap((item, i) =>
        permutations([...items.slice(0, i), ...items.slice(i + 1)]).map(rest => [item, ...rest]));
}

describe('filterCdx', () => {
    const currentYear = new Date().getFullYear();
    const validYear = currentYear - 2; // 2 years ago (passes embargo)

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

    describe('Timestamp parsing', () => {
        it('should compare redirects across a month boundary', () => {
            const data = [
                { status: '301', timestamp: `${validYear}0131233000`, digest: 'abc123', url: 'http://example.com' }, // 45 min before
                { status: '200', timestamp: `${validYear}0201001500`, digest: 'def456', url: 'http://example.com' }
            ];
            const result = filterCdx(data);
            expect(result.length).toBe(1);
            expect(result[0].status).toBe('200');
        });

        it('should filter out partial timestamps (they are not zero-padded into a valid date)', () => {
            const data = [
                { status: '200', timestamp: `${validYear}0101`, digest: 'abc123', url: 'http://example.com' },
                { status: '200', timestamp: `${validYear}`, digest: 'def456', url: 'http://example.com' }
            ];
            const result = filterCdx(data);
            expect(result).toEqual([]);
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

        it('should collapse same-day duplicates to the oldest one wherever they are in the input', () => {
            const a10 = { status: '200', timestamp: `${validYear}0101100000`, digest: 'abc123', url: 'http://example.com' };
            const b11 = { status: '200', timestamp: `${validYear}0101110000`, digest: 'def456', url: 'http://example.com' };
            const a12 = { status: '200', timestamp: `${validYear}0101120000`, digest: 'abc123', url: 'http://example.com' };
            permutations([a10, b11, a12]).forEach(data => {
                expect(filterCdx(data)).toEqual([a10, b11]);
            });
        });

        it('should keep the same digest on the same day of the month in another month or year', () => {
            const data = [
                { status: '200', timestamp: `${validYear}0305120000`, digest: 'abc123', url: 'http://example.com' },
                { status: '200', timestamp: `${validYear}0105120000`, digest: 'abc123', url: 'http://example.com' },
                { status: '200', timestamp: `${validYear - 1}0105120000`, digest: 'abc123', url: 'http://example.com' }
            ];
            const result = filterCdx(data);
            expect(result.map(item => item.timestamp)).toEqual([
                `${validYear - 1}0105120000`, `${validYear}0105120000`, `${validYear}0305120000`
            ]);
        });
    });

    describe('Embargo filtering', () => {
        // Pinned clock: TZ-independent, and the cutoff is exactly '20250310120000' (UTC)
        beforeEach(() => jest.useFakeTimers({ now: new Date('2026-03-10T12:00:00Z') }));
        afterEach(() => jest.useRealTimers());

        const item = (timestamp) => ({ status: '200', timestamp, digest: 'abc123', url: 'http://example.com' });

        it('should filter out items from current year', () => {
            expect(filterCdx([item('20260101120000')])).toEqual([]);
        });

        it('should keep items from just over 1 year ago and filter out those from exactly 1 year ago', () => {
            expect(filterCdx([item('20250310115959')]).length).toBe(1);
            expect(filterCdx([item('20250310120000')])).toEqual([]);
        });

        it('should keep items older than 1 year', () => {
            expect(filterCdx([item('20240101120000')]).length).toBe(1);
        });

        it('should clamp the cutoff to 28 Feb when today is 29 Feb', () => {
            jest.setSystemTime(new Date('2028-02-29T12:00:00Z')); // cutoff '20270228120000', not 1 Mar
            expect(filterCdx([item('20270228115959')]).length).toBe(1);
            expect(filterCdx([item('20270228120000')])).toEqual([]);
            expect(filterCdx([item('20270301115959')])).toEqual([]);
        });

        it.each([
            ['a leading space', ' 2026031012000'],
            ['a 00 year', '00260310120000'],
            ['a 00 year two years back', '00240310120000'],
            ['non-digits', '2024031012000a'],
            ['an invalid month', '20241310120000'],
            ['too short', '2024031012000'],
            ['too long', '202403101200000'],
        ])('should filter out timestamps with %s', (_, timestamp) => {
            expect(filterCdx([item(timestamp)])).toEqual([]);
        });
    });

    describe('Sorting', () => {
        it('should sort results by timestamp, oldest first, whatever the input order', () => {
            const data = [
                { status: '200', timestamp: `${validYear}0103120000`, digest: 'abc123', url: 'http://example.com' },
                { status: '200', timestamp: `${validYear}0101120000`, digest: 'def456', url: 'http://example.com' },
                { status: '200', timestamp: `${validYear - 1}1231120000`, digest: 'abc123', url: 'http://example.com' },
                { status: '200', timestamp: `${validYear}0102120000`, digest: 'ghi789', url: 'http://example.com' }
            ];
            permutations(data).forEach(shuffled => {
                expect(filterCdx(shuffled).map(item => item.timestamp)).toEqual([
                    `${validYear - 1}1231120000`, `${validYear}0101120000`, `${validYear}0102120000`, `${validYear}0103120000`
                ]);
            });
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
