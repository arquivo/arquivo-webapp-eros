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

    it('keeps any other character, including non-ASCII and backslashes', () => {
        const value = 'http://exemplo.pt/ação?q=café \\n "x" 😀';
        expect(escapeForLog(value)).toBe(value);
    });

    it('converts a value that is not a string', () => {
        expect(escapeForLog(undefined)).toBe('undefined');
        expect(escapeForLog(42)).toBe('42');
    });
});
