'use strict';

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

  // isValidUrl decides whether a search query is routed to URL search
  // (router.js /page/search, /image/search, /wayback/[*]/...), so these pin
  // the classification of realistic search input.
  describe('search query classification', () => {
    it.each([
      'publico.pt',
      'www.sapo.pt/path?x=1',
      'sapo.pt/',
      'PUBLICO.PT',
      'x.com',
      'a.co',
      'node.js',
      'ASP.NET',
      'mr.smith',
      'Sr.Silva',
      'Cavaco.Silva',
      'example.com.',
      'sub.domain.example.co.uk/a/b.html#top',
      'wikipedia.org/wiki/Lisboa',
      'arquivo.pt?x',
      'publico.pt/*',
      'medium.com/@user',
      'example.com/{x}',
      'ftp.example.com',
      '  publico.pt  ',
      '\tpublico.pt\n',
    ])('treats %j as a URL', (q) => {
      expect(isValidUrl(q)).toBe(true);
    });

    it.each([
      'publico',
      'Lisboa',
      'eleições 2024',
      'node.js tutorial',
      'what is node.js?',
      'publico.pt notícias',
      'foo bar.com',
      'Sr. Silva',
      'site:publico.pt',
      '*.publico.pt',
      '"node.js"',
      'C++',
      '.NET',
      'covid-19',
      '2024-01-01',
      '12:30',
      'www',
      'www.',
      'http',
      'a.b',
      '   ',
      '.',
      '.com',
      '-example.com',
      '@x.com',
      '//example.com',
    ])('treats %j as a text query', (q) => {
      expect(isValidUrl(q)).toBe(false);
    });

    // WHATWG parses these as IPv4 hosts (3.14 -> 3.0.0.14, 2024 -> 0.0.7.232).
    it.each([
      '3.14',
      ' 3.14 ',
      '1.5',
      '2024',
      '1.2.3',
      '1.2.3.4',
      '10.000',
      '25.04.1974',
      '0x1F',
      '1e5',
      '3.5mm',
      '1.5kg',
      '€3.50',
      '3.50€',
      'v1.2',
      'v2.0rc1',
      'web2.0',
    ])('treats the number-like query %j as a text query', (q) => {
      expect(isValidUrl(q)).toBe(false);
    });

    it.each([
      '192.168.1.1',
      'http://192.168.1.1/admin',
      '[::1]',
      'http://[::1]/',
      'http://[2001:db8::1]:8080/',
      'localhost',
      'localhost:3000',
      'http://localhost:3000',
    ])('rejects the IP / local host %j', (q) => {
      expect(isValidUrl(q)).toBe(false);
    });

    // WHATWG (UTS46 without the STD3 rules) allows `,;!&+=*~$()` in a host;
    // the old regex did not, and neither does a real hostname.
    it.each([
      'Lisboa,R.Augusta',
      'Porto,Av.Boavista',
      'ok,tudo.bem',
      'Sim,Sr.Silva',
      'Benfica(SLB).pt',
      'AT&T.com',
      'R&D.pt',
      'Yahoo!.com',
      '2+2.com',
      'x=y.com',
      'a*b.com',
      'a~b.com',
      'a$b.com',
    ])('treats punctuation inside the host as text: %j', (q) => {
      expect(isValidUrl(q)).toBe(false);
    });
  });

  describe('non-http(s) schemes and unsafe input', () => {
    it.each([
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      'javascript:alert(document.cookie)',
      'javascript://example.com/%0aalert(1)',
      'data:text/html,<script>alert(1)</script>',
      'data:text/plain;base64,SGVsbG8=',
      'data:,example.com',
      'ftp://ftp.example.com',
      'file:///etc/passwd',
      'ws://example.com',
      'mailto:joao@sapo.pt',
      // Parsed as user `javascript` on host `evil.com`; the credentials check rejects them.
      'javascript:x@evil.com',
      'javascript:@evil.com',
    ])('rejects %j', (q) => {
      expect(isValidUrl(q)).toBe(false);
    });

    it.each([
      'joao@sapo.pt',
      'user:pass@example.com',
      'https://user@example.com',
    ])('rejects credentials / e-mail addresses: %j', (q) => {
      expect(isValidUrl(q)).toBe(false);
    });

    // The archive-page-now page renders the accepted URL unescaped.
    it.each([
      'example.com/"><script>alert(1)</script>',
      "example.com/joana's",
      'https://example.com/a b',
      'publico.pt/a b',
      'exam\nple.com',
      'publico.pt/\uFEFFx', // BOM
      'https://example.com/?a[]=1',
    ])('rejects quotes, angle brackets, brackets and inner whitespace: %j', (q) => {
      expect(isValidUrl(q)).toBe(false);
    });

    // Invisible or control characters that could spoof the displayed URL.
    it.each([
      ['C0 control', 'publico.pt/\u0000x'],
      ['DEL', 'publico.pt/\u007Fx'],
      ['C1 control', 'publico.pt/\u0080x'],
      ['NEL', 'publico.pt/\u0085x'],
      ['C1 control', 'publico.pt/\u009Fx'],
      ['soft hyphen', 'pub\u00ADlico.pt'],
      ['combining grapheme joiner in the host', 'publico\u034F.pt'],
      ['ALM', 'publico.pt/\u061Cx'],
      ['Hangul choseong filler', 'publico.pt/\u115Fx'],
      ['Hangul jungseong filler', 'publico.pt/\u1160x'],
      ['Khmer inherent vowel AQ', 'publico.pt/\u17B4x'],
      ['Khmer inherent vowel AA', 'publico.pt/\u17B5x'],
      ['Mongolian vowel separator', 'publico.pt/\u180Ex'],
      ['zero-width space', 'publico\u200B.pt'],
      ['LRM', 'publico.pt/\u200Ex'],
      ['RLM', 'publico.pt/\u200Fx'],
      ['LRE', 'publico.pt/\u202Ax'],
      ['RLO', 'publico.pt/\u202Ex'],
      ['word joiner in the host', 'publico\u2060.pt'],
      ['invisible plus in the host', 'publico\u2064.pt'],
      ['LRI', 'publico.pt/\u2066x'],
      ['PDI', 'publico.pt/\u2069x'],
      ['deprecated format character', 'publico.pt/\u206Ax'],
      ['Hangul filler', 'publico.pt/\u3164x'],
      ['half-width Hangul filler', 'publico.pt/\uFFA0x'],
      ['reserved default-ignorable code point', 'publico.pt/\uFFF0x'],
      ['interlinear annotation anchor', 'publico.pt/\uFFF9x'],
      ['interlinear annotation terminator', 'publico.pt/\uFFFBx'],
      ['shorthand format letter overlap in the host', 'pub\u{1BCA0}lico.pt'],
      ['shorthand format letter overlap', 'publico.pt/\u{1BCA0}x'],
      ['musical symbol begin beam', 'publico.pt/\u{1D173}x'],
      ['tag character', 'publico.pt/\u{E0001}x'],
      ['cancel tag', 'publico.pt/\u{E007F}x'],
      ['reserved default-ignorable code point', 'publico.pt/\u{E0080}x'],
      ['reserved default-ignorable code point', 'publico.pt/\u{E0FFF}x'],
    ])('rejects a %s: %j', (_name, q) => {
      expect(isValidUrl(q)).toBe(false);
    });

    // Not all format characters are blocked: some IDNs need ZWNJ/ZWJ.
    it.each(['\u0646\u0627\u0645\u0647\u200C\u0627\u06CC.ir', '\u0915\u094D\u200D\u0937.com'])(
      'accepts the IDN with a joiner %j',
      (q) => {
        expect(isValidUrl(q)).toBe(true);
      },
    );

    // Nor are variation selectors: they pick the glyph of the character before them.
    it.each([
      ['VS16 emoji in the path', 'example.com/\u2764\uFE0F'],
      ['VS16 emoji in the host', 'i\u2764\uFE0F.ws'],
      ['Mongolian free variation selector', 'example.com/\u1820\u180B'],
      ['Mongolian free variation selector four', 'example.com/\u1820\u180F'],
      ['VS1', 'example.com/\u2764\uFE00'],
      ['ideographic variation selector', 'example.com/\u845B\u{E0100}'],
      ['VS256', 'example.com/\u845B\u{E01EF}'],
    ])('accepts a %s: %j', (_name, q) => {
      expect(isValidUrl(q)).toBe(true);
    });

    it('accepts a very long URL', () => {
      expect(isValidUrl('https://example.com/' + 'a/'.repeat(10000))).toBe(true);
      expect(isValidUrl('a'.repeat(5000) + '.com')).toBe(true);
    });

    it('returns quickly on input that made the old regex backtrack', () => {
      // The old regex took ~1.6 s on this input (quadratic backtracking).
      const start = process.hrtime.bigint();
      expect(isValidUrl('a' + '.'.repeat(16000) + '"')).toBe(false);
      // No forbidden character, so this one goes through the URL parser.
      expect(isValidUrl('a' + '.'.repeat(16000) + '!')).toBe(false);
      expect(isValidUrl('a' + '.aa'.repeat(10000) + '"')).toBe(false);
      expect(Number(process.hrtime.bigint() - start) / 1e6).toBeLessThan(100);
    });

    it.each([undefined, null, 42, ['example.com'], { href: 'https://example.com' }])(
      'rejects the non-string %j',
      (value) => {
        expect(isValidUrl(value)).toBe(false);
      },
    );
  });

  // Inputs whose classification changed when the regex was replaced by the
  // WHATWG URL parser.
  describe('changes from the regex implementation', () => {
    it.each([
      'HTTP://EXAMPLE.COM',
      'Https://Publico.pt',
      'https://pt.wikipedia.org/wiki/Póvoa_de_Varzim',
      'público.pt',
      'https://público.pt',
      'münchen.de',
      'café.fr/menu',
      '例子.测试',
    ])('accepts upper-case schemes and non-ASCII hosts/paths: %j', (q) => {
      expect(isValidUrl(q)).toBe(true);
    });

    // UTS46 maps the ideographic, full-width and half-width full stops to `.`
    // and full-width letters to ASCII.
    it.each([
      ['ideographic full stop', 'publico\u3002pt'],
      ['full-width full stop', 'publico\uFF0Ept'],
      ['half-width ideographic full stop', 'publico\uFF61pt'],
      ['full-width letters', '\uFF50\uFF55\uFF42\uFF4C\uFF49\uFF43\uFF4F.\uFF50\uFF54'],
    ])('accepts a host with %s: %j', (_name, q) => {
      expect(isValidUrl(q)).toBe(true);
    });

    it('accepts the punycode form of an IDN', () => {
      // xn--pblico-pya.pt is público.pt.
      expect(isValidUrl('xn--pblico-pya.pt')).toBe(true);
    });

    // Like the ASCII `Sr.Silva` / `Cavaco.Silva` (already URLs), accented
    // `word.word` tokens are now routed to URL search.
    it.each(['Sr.José', 'D.João', 'José.Saramago', 'Av.República', 'séc.XX'])(
      'accepts the accented word.word token %j',
      (q) => {
        expect(isValidUrl(q)).toBe(true);
      },
    );

    // Prose pasted with trailing punctuation is not a URL.
    it.each([
      'publico.pt,',
      'publico.pt;',
      'publico.pt!',
      'publico.pt)',
      'publico.pt...',
      'Viva.Portugal!',
      '25.Abril.1974',
      'a.C.',
      'd.C.',
    ])('rejects trailing punctuation and dotted dates/abbreviations: %j', (q) => {
      expect(isValidUrl(q)).toBe(false);
    });

    // The `,` / `;` is inside the host, which allows only letters, digits, `-`, `_` and dots.
    it.each(['sapo.pt,publico.pt', 'publico.pt;sapo.pt'])(
      'rejects two domains joined by punctuation: %j',
      (q) => {
        expect(isValidUrl(q)).toBe(false);
      },
    );

    it.each([
      'e.g.',
      'i.e.',
      'U.S.A.',
      'O.K.',
      'html5.css3',
      'www.example.c0m',
      'example.com:99999',
      'publico.pt:abc',
      'joao.silva@sapo.pt',
    ])('rejects abbreviations, non-letter TLDs, bad ports and e-mails: %j', (q) => {
      expect(isValidUrl(q)).toBe(false);
    });
  });
});
