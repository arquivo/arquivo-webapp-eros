const localIsoDate = require('../local-iso-date');

// Jest runs with TZ=Pacific/Kiritimati (UTC+14, see jest.global-setup.js), so
// just after local midnight the UTC date is still the previous day.
describe('localIsoDate', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it('formats a date as YYYY-MM-DD with zero-padded month and day', () => {
        expect(localIsoDate(new Date(2024, 0, 5, 12, 0, 0))).toBe('2024-01-05');
        expect(localIsoDate(new Date(2024, 11, 31, 12, 0, 0))).toBe('2024-12-31');
    });

    it('uses the local date just after local midnight, not the UTC one', () => {
        const justAfterMidnight = new Date(2024, 0, 1, 0, 0, 1);

        expect(justAfterMidnight.toISOString().slice(0, 10)).toBe('2023-12-31');
        expect(localIsoDate(justAfterMidnight)).toBe('2024-01-01');
        // Same as the toLocaleDateString('en-CA') idiom it replaces.
        expect(localIsoDate(justAfterMidnight)).toBe(justAfterMidnight.toLocaleDateString('en-CA'));
    });

    it('uses the local date just before local midnight', () => {
        expect(localIsoDate(new Date(2023, 11, 31, 23, 59, 59))).toBe('2023-12-31');
    });

    it('defaults to the current local date', () => {
        jest.useFakeTimers({ now: new Date(2024, 2, 1, 0, 0, 1) });

        expect(localIsoDate()).toBe('2024-03-01');
    });
});
