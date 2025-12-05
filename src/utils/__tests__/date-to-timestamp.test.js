const dateToTimestamp = require('../../../src/utils/date-to-timestamp');

describe('dateToTimestamp', () => {
  it('should convert a date to timestamp format (YYYYMMDDHHmmss)', () => {
    const date = new Date('2024-03-15T14:30:45');
    const result = dateToTimestamp(date);
    expect(result).toBe('20240315143045');
  });

  it('should add leading zeros to single-digit values', () => {
    const date = new Date('2024-01-05T09:08:07');
    const result = dateToTimestamp(date);
    expect(result).toBe('20240105090807');
  });

  it('should handle midnight correctly', () => {
    const date = new Date('2024-12-31T00:00:00');
    const result = dateToTimestamp(date);
    expect(result).toBe('20241231000000');
  });

  it('should handle end of day correctly', () => {
    const date = new Date('2024-06-30T23:59:59');
    const result = dateToTimestamp(date);
    expect(result).toBe('20240630235959');
  });

  it('should handle leap year date', () => {
    const date = new Date('2024-02-29T12:30:00');
    const result = dateToTimestamp(date);
    expect(result).toBe('20240229123000');
  });
});
