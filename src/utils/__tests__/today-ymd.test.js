const todayYmd = require('../../../src/utils/today-ymd');

describe('todayYmd', () => {
  it('should return today as an 8 digit YYYYMMDD string', () => {
    expect(todayYmd()).toMatch(/^\d{8}$/);
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

  it('should convert a given date to YYYYMMDD', () => {
    expect(todayYmd(new Date(2024, 2, 15, 14, 30, 45))).toBe('20240315');
  });

  it('should add leading zeros to single-digit months and days', () => {
    expect(todayYmd(new Date(2024, 0, 5))).toBe('20240105');
  });

  it('should use the local date just before midnight', () => {
    expect(todayYmd(new Date(2024, 11, 31, 23, 59, 59, 999))).toBe('20241231');
  });

  it('should use the local date just after midnight', () => {
    expect(todayYmd(new Date(2025, 0, 1, 0, 0, 0, 0))).toBe('20250101');
  });
});
