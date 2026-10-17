'use strict';

const { asciiHost, displayUrl } = require('../display-url');

const FSI = '\u2068';
const PDI = '\u2069';

describe('asciiHost', () => {
  describe('URLs whose authority is written with non-ASCII characters', () => {
    it.each([
      ['http://exämple.pt/', 'xn--exmple-cua.pt'],
      ['https://mañana.com/página', 'xn--maana-pta.com'],
      ['http://例え.テスト/', 'xn--r8jz45g.xn--zckzah'],
      ['http://exämple.pt:8080/a?b=c#d', 'xn--exmple-cua.pt'],
      ['HTTP://EXÄMPLE.PT/', 'xn--exmple-cua.pt'],
      // `а` is CYRILLIC SMALL LETTER A (U+0430), not the Latin `a`.
      ['http://pаypal.com/login', 'xn--pypal-4ve.com'],
      // Fullwidth characters map to their ASCII form.
      ['http://ｅxample.com/', 'example.com'],
      // Non-ASCII user info: the host actually used.
      ['http://аpple.com@evil.com/', 'evil.com'],
      // Backslashes separate the host, as in the URL parser.
      ['http:\\\\exämple.pt\\path', 'xn--exmple-cua.pt'],
      // The URL parser's preprocessing: outer spaces and controls are
      // stripped, tabs and newlines anywhere are removed.
      ['  http://exämple.pt/ ', 'xn--exmple-cua.pt'],
      ['\u0000http://exämple.pt/\u001F', 'xn--exmple-cua.pt'],
      ['http\t://exämple.pt/', 'xn--exmple-cua.pt'],
      ['ht\ntp://ex\rämple.pt/', 'xn--exmple-cua.pt'],
    ])('should give the ASCII host of %p', (url, expected) => {
      expect(asciiHost(url)).toBe(expected);
    });
  });

  describe('no ASCII host to show', () => {
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
      ['undefined', undefined],
      ['null', null],
      ['a number', 42],
      ['an object', { toString: () => 'http://exämple.pt/' }],
      ['an array', ['http://exämple.pt/']],
    ])('should give an empty string for %s', (_, url) => {
      expect(asciiHost(url)).toBe('');
    });
  });
});

describe('displayUrl', () => {
  it('should isolate the URL and add its ASCII host', () => {
    expect(displayUrl('http://exämple.pt/')).toBe(`${FSI}http://exämple.pt/${PDI} (xn--exmple-cua.pt)`);
  });

  it('should add the ASCII host to the given text instead of the URL', () => {
    expect(displayUrl('http://exämple.pt/', 'exämple.pt')).toBe(`${FSI}exämple.pt${PDI} (xn--exmple-cua.pt)`);
  });

  it('should keep a right-to-left override in the URL from reordering the host', () => {
    const url = 'http://exämple.pt/?q=\u202Eabc';

    expect(displayUrl(url)).toBe(`${FSI}${url}${PDI} (xn--exmple-cua.pt)`);
  });

  it.each([
    ['https://www.publico.pt/'],
    ['José Silva'],
    [undefined],
    [42],
  ])('should return %p unchanged when there is no ASCII host to show', (url) => {
    expect(displayUrl(url)).toBe(url);
  });

  it('should return the given text unchanged for an ASCII host', () => {
    expect(displayUrl('https://www.publico.pt/', 'publico.pt')).toBe('publico.pt');
  });
});
