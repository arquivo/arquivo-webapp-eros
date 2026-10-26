'use strict';

const textAfterFirst = require('../text-after-first');

// The split/filter/join idiom textAfterFirst replaces, kept as the reference.
const legacy = (text, token) => text.split(token).filter((_, i) => i > 0).join(token);

describe('textAfterFirst', () => {
    it('returns the text after the first occurrence of the token', () => {
        expect(textAfterFirst('20230101120000/example.com', '/')).toBe('example.com');
    });

    it('keeps later occurrences of the token (first occurrence only)', () => {
        expect(textAfterFirst('20230101120000/example.com/a/b', '/')).toBe('example.com/a/b');
        expect(textAfterFirst('https://h/noFrame/replay/2023/example.com/replay/x', 'replay/'))
            .toBe('2023/example.com/replay/x');
    });

    it('returns an empty string when the token is absent', () => {
        expect(textAfterFirst('20230101120000', '/')).toBe('');
        expect(textAfterFirst('https://other.example/2023/example.com', 'replay/')).toBe('');
    });

    it.each([
        ['20230101120000/example.com', '/'],
        ['20230101120000/example.com/a//b/', '/'],
        ['20230101120000', '/'],
        ['/example.com', '/'],
        ['20230101120000/', '/'],
        ['a//b', '/'],
        ['/', '/'],
        ['', '/'],
        ['https://h/noFrame/replay/2023/example.com', 'replay/'],
        ['https://h/noFrame/replay/2023/example.com/replay/replay/', 'replay/'],
        ['https://other.example/2023/example.com', 'replay/'],
        ['replay/', 'replay/'],
    ])('matches the split/filter/join idiom for %j split on %j', (text, token) => {
        expect(textAfterFirst(text, token)).toBe(legacy(text, token));
    });
});
