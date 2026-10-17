'use strict';

const displayUrl = require('../display-url');

describe('displayUrl', () => {
  describe('URLs whose host is written with non-ASCII characters', () => {
    it.each([
      ['http://exämple.pt/', 'http://exämple.pt/ (xn--exmple-cua.pt)'],
      ['https://mañana.com/página', 'https://mañana.com/página (xn--maana-pta.com)'],
      ['http://例え.テスト/', 'http://例え.テスト/ (xn--r8jz45g.xn--zckzah)'],
      ['http://exämple.pt:8080/a?b=c#d', 'http://exämple.pt:8080/a?b=c#d (xn--exmple-cua.pt)'],
      ['HTTP://EXÄMPLE.PT/', 'HTTP://EXÄMPLE.PT/ (xn--exmple-cua.pt)'],
    ])('should add the punycode host to %s', (url, expected) => {
      expect(displayUrl(url)).toBe(expected);
    });

    it('should show a mixed-script lookalike host in punycode', () => {
      // `а` is CYRILLIC SMALL LETTER A (U+0430), not the Latin `a`.
      expect(displayUrl('http://pаypal.com/login'))
        .toBe('http://pаypal.com/login (xn--pypal-4ve.com)');
    });

    it('should show the ASCII host that fullwidth characters map to', () => {
      expect(displayUrl('http://ｅxample.com/')).toBe('http://ｅxample.com/ (example.com)');
    });

    it('should show the host actually used when the user info is not ASCII', () => {
      expect(displayUrl('http://аpple.com@evil.com/')).toBe('http://аpple.com@evil.com/ (evil.com)');
    });

    it('should find the host after backslashes, as the URL parser does', () => {
      expect(displayUrl('http:\\\\exämple.pt\\path')).toBe('http:\\\\exämple.pt\\path (xn--exmple-cua.pt)');
    });

    it('should add the host to the given text instead of the URL', () => {
      expect(displayUrl('http://exämple.pt/', 'exämple.pt')).toBe('exämple.pt (xn--exmple-cua.pt)');
    });
  });

  describe('values shown unchanged', () => {
    it.each([
      ['an ASCII host', 'https://www.publico.pt/'],
      ['an ASCII host with a non-ASCII path', 'https://www.publico.pt/página?q=ñ#ç'],
      ['a host already in punycode', 'https://xn--exmple-cua.pt/'],
      ['a percent-encoded host', 'http://ex%C3%A4mple.pt/'],
      ['an IPv4 address', 'http://127.0.0.1/'],
      ['an IPv6 address', 'http://[::1]/'],
      ['a URL without a scheme', 'exämple.pt'],
      ['another scheme', 'ftp://exämple.pt/'],
      ['an invalid URL', 'http://exä mple.pt/'],
      ['an invalid port', 'http://exämple.pt:99999/'],
      ['a URL without a host', 'http://'],
      ['plain text', 'José Silva'],
      ['an empty string', ''],
    ])('should return %s unchanged', (_, url) => {
      expect(displayUrl(url)).toBe(url);
    });

    it('should return the given text unchanged for an ASCII host', () => {
      expect(displayUrl('https://www.publico.pt/', 'publico.pt')).toBe('publico.pt');
    });

    it.each([
      [undefined],
      [null],
      [42],
      [{ toString: () => 'http://exämple.pt/' }],
      [['http://exämple.pt/']],
    ])('should return the non-string %p unchanged', (value) => {
      expect(displayUrl(value)).toBe(value);
    });

    it('should return a non-string text unchanged', () => {
      expect(displayUrl('http://exämple.pt/', 42)).toBe(42);
    });
  });
});
