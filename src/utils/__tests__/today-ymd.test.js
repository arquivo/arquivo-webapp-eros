const todayYmd = require('../../../src/utils/today-ymd');

// Jest runs in Pacific/Kiritimati (UTC+14, see jest.global-setup.js), so a UTC
// based implementation would return a different date for most of these.
describe('todayYmd', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return the local date of today', () => {
    const localYmd = (d) => [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('');
    const before = new Date();
    const result = todayYmd();
    const after = new Date();
    // the day may roll over between both reads of the clock
    expect([localYmd(before), localYmd(after)]).toContain(result);
  });

  it('should read the clock on every call', () => {
    jest.useFakeTimers().setSystemTime(new Date(2024, 2, 15, 12));
    expect(todayYmd()).toBe('20240315');
    jest.setSystemTime(new Date(2024, 2, 16, 12));
    expect(todayYmd()).toBe('20240316');
  });

  it('should add leading zeros to single-digit months and days', () => {
    expect(todayYmd(new Date(2024, 0, 5))).toBe('20240105');
  });

  it('should use the local date when the UTC date is still the day before', () => {
    // 00:30 local on 1 January is 10:30 UTC on 31 December in UTC+14
    expect(todayYmd(new Date(2025, 0, 1, 0, 30))).toBe('20250101');
  });
});
