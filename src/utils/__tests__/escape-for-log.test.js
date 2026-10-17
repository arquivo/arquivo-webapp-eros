'use strict';

const escapeForLog = require('../escape-for-log');

describe('escapeForLog', () => {
    it('escapes CR and LF, so a value cannot start a new log line', () => {
        expect(escapeForLog('a\r\n01/Jan/2026:00:00:00\tINFO\tFake\t-\tforged'))
            .toBe('a\\u000d\\u000a01/Jan/2026:00:00:00\\u0009INFO\\u0009Fake\\u0009-\\u0009forged');
    });

    it('escapes the other C0 and C1 control characters and the line and paragraph separators', () => {
        expect(escapeForLog('\u0000\u001b[31m\u007f\u0085\u009f\u2028\u2029'))
            .toBe('\\u0000\\u001b[31m\\u007f\\u0085\\u009f\\u2028\\u2029');
    });

    it('escapes the bidirectional and other invisible format characters', () => {
        expect(escapeForLog('a\u061c\u200e\u200f\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069b\u200b\u00ad\ufeff'))
            .toBe('a\\u061c\\u200e\\u200f\\u202a\\u202b\\u202c\\u202d\\u202e\\u2066\\u2067\\u2068\\u2069b\\u200b\\u00ad\\ufeff');
    });

    it('escapes the backslash, so an escape in the value cannot pass for one of its own', () => {
        expect(escapeForLog('a\\u000a\\b')).toBe('a\\u005cu000a\\u005cb');
        expect(escapeForLog('a\\u000a')).not.toBe(escapeForLog('a\n'));
    });

    it('keeps any other character, including non-ASCII ones', () => {
        const value = 'http://exemplo.pt/ação?q=café "x" 😀';
        expect(escapeForLog(value)).toBe(value);
    });

    it('converts a value that is not a string', () => {
        expect(escapeForLog(undefined)).toBe('undefined');
        expect(escapeForLog(42)).toBe('42');
    });

    it('never throws, even for a value that cannot be converted to a string', () => {
        const throwing = { toString() { throw new Error('jane.doe@example.pt'); } };
        const revoked = Proxy.revocable({}, {});
        revoked.revoke();
        expect(escapeForLog(Object.create(null))).toBe('[unprintable]');
        expect(escapeForLog(throwing)).toBe('[unprintable]');
        expect(escapeForLog(revoked.proxy)).toBe('[unprintable]');
        expect(escapeForLog(Symbol('s'))).toBe('Symbol(s)');
    });
});
