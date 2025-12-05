// Mock the logger to avoid config dependency issues
jest.mock('../../../src/logger', () => {
  return jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn()
  }));
});

const timestampToText = require('../../../src/utils/timestamp-to-text');

describe('timestampToText', () => {
  const mockTranslate = jest.fn((key, params) => {
    const translations = {
      'common.shortMonths.00': 'Jan',
      'common.shortMonths.01': 'Jan',
      'common.shortMonths.02': 'Feb',
      'common.shortMonths.06': 'Jun',
      'common.shortMonths.12': 'Dec',
      'common.months.00': 'January',
      'common.months.01': 'January',
      'common.months.02': 'February',
      'common.months.06': 'June',
      'common.months.12': 'December',
    };
    
    // If no params, it's a nested call for month name
    if (!params) {
      return translations[key] || key;
    }
    
    // For date format calls
    if (key === 'common.date.short') {
      return `${params.month} ${params.day}`;
    }
    if (key === 'common.date.medium') {
      return `${params.day} ${params.month} ${params.year}, ${params.hours}:${params.minutes}`;
    }
    if (key === 'common.date.long') {
      return `${params.day} de ${params.month} de ${params.year}, ${params.hours}:${params.minutes}`;
    }
    
    return translations[key] || key;
  });

  beforeEach(() => {
    mockTranslate.mockClear();
  });

  describe('short format', () => {
    it('should format timestamp to short date', () => {
      const formatter = timestampToText(mockTranslate);
      const result = formatter.short('20240115143045');
      expect(result).toBe('Jan 15');
    });

    it('should handle timestamp with trailing zeros', () => {
      const formatter = timestampToText(mockTranslate);
      const result = formatter.short('20241231');
      expect(result).toBe('Dec 31');
    });

    it('should pad short timestamps', () => {
      const formatter = timestampToText(mockTranslate);
      const result = formatter.short('202402');
      // Day 00 is padded, parseInt('00') = 0
      expect(result).toBe('Feb 0');
    });
  });

  describe('medium format', () => {
    it('should format timestamp to medium date with time', () => {
      const formatter = timestampToText(mockTranslate);
      const result = formatter.medium('20240215143045');
      expect(result).toBe('15 February 2024, 14:30');
    });

    it('should handle midnight time', () => {
      const formatter = timestampToText(mockTranslate);
      const result = formatter.medium('20240101000000');
      expect(result).toBe('1 January 2024, 00:00');
    });
  });

  describe('long format', () => {
    it('should format timestamp to long date with time', () => {
      const formatter = timestampToText(mockTranslate);
      const result = formatter.long('20241225143045');
      expect(result).toBe('25 de December de 2024, 14:30');
    });

    it('should handle end of day time', () => {
      const formatter = timestampToText(mockTranslate);
      const result = formatter.long('20240630235959');
      expect(result).toBe('30 de June de 2024, 23:59');
    });
  });

  describe('error handling', () => {
    it('should handle non-string input', () => {
      const formatter = timestampToText(mockTranslate);
      const result = formatter.short(12345678901234);
      // Non-string input is handled with error logging and padding
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should handle empty string', () => {
      const formatter = timestampToText(mockTranslate);
      const result = formatter.short('');
      expect(result).toBeDefined();
    });
  });
});
