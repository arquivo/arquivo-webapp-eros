const isValidUrl = require('../../../src/utils/is-valid-url');

describe('isValidUrl', () => {
  describe('valid URLs', () => {
    it('should accept HTTP URLs', () => {
      expect(isValidUrl('http://example.com')).toBe(true);
    });

    it('should accept HTTPS URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
    });

    it('should accept URLs without protocol', () => {
      expect(isValidUrl('example.com')).toBe(true);
    });

    it('should accept URLs with paths', () => {
      expect(isValidUrl('https://example.com/path/to/page')).toBe(true);
    });

    it('should accept URLs with query parameters', () => {
      expect(isValidUrl('https://example.com/page?param=value&foo=bar')).toBe(true);
    });

    it('should accept URLs with ports', () => {
      expect(isValidUrl('http://example.com:8080')).toBe(true);
    });

    it('should accept URLs with subdomains', () => {
      expect(isValidUrl('https://sub.domain.example.com')).toBe(true);
    });

    it('should accept URLs with hyphens in domain', () => {
      expect(isValidUrl('https://my-site.example.com')).toBe(true);
    });

    it('should accept URLs with encoded characters', () => {
      expect(isValidUrl('https://example.com/page-name')).toBe(true);
    });

    it('should accept URLs with special characters', () => {
      expect(isValidUrl('https://example.com/path?q=test#anchor')).toBe(true);
    });

    it('should accept URLs with trailing slash', () => {
      expect(isValidUrl('https://example.com/')).toBe(true);
    });

    it('should accept URLs with spaces around them', () => {
      expect(isValidUrl('  https://example.com  ')).toBe(true);
    });
  });

  describe('invalid URLs', () => {
    it('should reject empty strings', () => {
      expect(isValidUrl('')).toBe(false);
    });

    it('should reject URLs without domain', () => {
      expect(isValidUrl('http://')).toBe(false);
    });

    it('should reject invalid protocol', () => {
      expect(isValidUrl('ftp://example.com')).toBe(false);
    });

    it('should reject URLs with spaces in domain', () => {
      expect(isValidUrl('http://exam ple.com')).toBe(false);
    });

    it('should reject single word without TLD', () => {
      expect(isValidUrl('example')).toBe(false);
    });

    it('should reject just a slash', () => {
      expect(isValidUrl('/')).toBe(false);
    });

    it('should reject malformed URLs', () => {
      expect(isValidUrl('ht!tp://example.com')).toBe(false);
    });
  });
});
