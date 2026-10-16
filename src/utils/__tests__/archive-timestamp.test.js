const { parseArchiveTimestamp, archiveTimestampToDate } = require('../archive-timestamp');

describe('archive-timestamp', () => {
    describe('parseArchiveTimestamp', () => {
        it('should split a full timestamp into string parts', () => {
            expect(parseArchiveTimestamp('20240315143045')).toEqual({
                year: '2024', month: '03', day: '15', hours: '14', minutes: '30', seconds: '45'
            });
        });

        it('should ignore characters beyond the 14th', () => {
            expect(parseArchiveTimestamp('20240315143045123').seconds).toBe('45');
        });

        it('should leave the missing parts of a partial timestamp empty by default', () => {
            expect(parseArchiveTimestamp('2024031')).toEqual({
                year: '2024', month: '03', day: '1', hours: '', minutes: '', seconds: ''
            });
        });

        it('should right-pad a partial timestamp with zeros when asked to', () => {
            expect(parseArchiveTimestamp('2024031', { pad: true })).toEqual({
                year: '2024', month: '03', day: '10', hours: '00', minutes: '00', seconds: '00'
            });
            expect(parseArchiveTimestamp('', { pad: true })).toEqual({
                year: '0000', month: '00', day: '00', hours: '00', minutes: '00', seconds: '00'
            });
        });

        it('should throw on a non-string timestamp', () => {
            expect(() => parseArchiveTimestamp(20240315143045)).toThrow(TypeError);
            expect(() => parseArchiveTimestamp(undefined)).toThrow(TypeError);
        });
    });

    describe('archiveTimestampToDate', () => {
        it('should build a local time Date (1-based timestamp month)', () => {
            expect(archiveTimestampToDate('20240315143045')).toEqual(new Date(2024, 2, 15, 14, 30, 45));
        });

        it('should handle month and year boundaries', () => {
            expect(archiveTimestampToDate('20240131235959')).toEqual(new Date(2024, 0, 31, 23, 59, 59));
            expect(archiveTimestampToDate('20231231235959').getTime() + 1000)
                .toBe(archiveTimestampToDate('20240101000000').getTime());
        });

        it('should give an Invalid Date for a partial timestamp', () => {
            expect(archiveTimestampToDate('20240315').getTime()).toBeNaN();
        });
    });
});
