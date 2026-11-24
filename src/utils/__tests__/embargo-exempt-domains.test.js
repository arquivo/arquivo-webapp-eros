'use strict';

const { parseEmbargoExemptDomains, isEmbargoExempt } = require('../embargo-exempt-domains');

describe('parseEmbargoExemptDomains', () => {
    it.each([
        [undefined, []],
        [null, []], // what the config library gives for an empty value
        ['', []],
        ['  ', []],
        ['blogs.sapo.pt', ['blogs.sapo.pt']],
        [' Blogs.SAPO.pt , example.com ', ['blogs.sapo.pt', 'example.com']],
        ['xn--bcher-kva.example', ['xn--bcher-kva.example']],
        ['bücher.example', ['xn--bcher-kva.example']],
        ['a-b.c1.pt', ['a-b.c1.pt']],
    ])('maps %p to %p', (value, expected) => {
        expect(parseEmbargoExemptDomains(value)).toEqual(expected);
    });

    it.each([
        '*',
        '*.blogs.sapo.pt',
        'pt',
        'blogs.sapo.pt,',
        'blogs.sapo.pt,,example.com',
        'blogs.sapo.pt.',
        '.blogs.sapo.pt',
        'blogs..sapo.pt',
        'http://blogs.sapo.pt',
        'blogs.sapo.pt/',
        'blogs.sapo.pt:80',
        'blogs sapo.pt',
        '-blogs.sapo.pt',
        'blogs-.sapo.pt',
        'blogs_x.sapo.pt',
        '192.168.0.1',
        `${'a'.repeat(64)}.pt`,
        `${'a.'.repeat(127)}pt`,
    ])('refuses %p', (value) => {
        expect(() => parseEmbargoExemptDomains(value))
            .toThrow(/"embargo\.exempt\.domains" \(EMBARGO_EXEMPT_DOMAINS\) must be a comma-separated list of domain names/);
    });
});

describe('isEmbargoExempt', () => {
    const domains = ['blogs.sapo.pt'];

    it.each([
        'http://blogs.sapo.pt/',
        'https://blogs.sapo.pt/some/post',
        'http://xpto.blogs.sapo.pt/',
        'http://a.b.blogs.sapo.pt/2024/01/post.html',
        'http://XPTO.Blogs.Sapo.PT/',
        'http://xpto.blogs.sapo.pt.:8080/',
        'http://user:pass@xpto.blogs.sapo.pt/',
    ])('exempts %p', (url) => {
        expect(isEmbargoExempt(url, domains)).toBe(true);
    });

    it.each([
        'http://sapo.pt/',
        'http://notblogs.sapo.pt/',
        'http://blogs.sapo.pt.example.com/',
        'http://blogs.sapo.pt@example.com/',
        'http://example.com/blogs.sapo.pt',
        'http://example.com/?u=http://xpto.blogs.sapo.pt/',
        'xpto.blogs.sapo.pt/',
        'dns:xpto.blogs.sapo.pt',
        '',
        'not a url',
    ])('does not exempt %p', (url) => {
        expect(isEmbargoExempt(url, domains)).toBe(false);
    });

    it('exempts nothing when there are no domains', () => {
        expect(isEmbargoExempt('http://blogs.sapo.pt/', [])).toBe(false);
    });

    it('matches internationalised hosts in punycode', () => {
        expect(isEmbargoExempt('http://www.bücher.example/', ['xn--bcher-kva.example'])).toBe(true);
    });
});
