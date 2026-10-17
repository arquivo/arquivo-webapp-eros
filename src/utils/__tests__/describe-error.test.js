'use strict';

const describeError = require('../describe-error');

describe('describeError', () => {
    it('gives the name and codes of an error, never its message', () => {
        const err = Object.assign(new Error('request to https://example.com/?email=jane.doe@example.pt failed'),
            { name: 'FetchError', type: 'system', code: 'ECONNREFUSED', errno: 'ECONNREFUSED' });

        expect(describeError(err)).toBe('name: "FetchError", type: "system", code: "ECONNREFUSED", errno: "ECONNREFUSED"');
    });

    it('gives the syscall and HTTP status when there are', () => {
        const err = Object.assign(new TypeError('x'), { syscall: 'open', status: 400 });

        expect(describeError(err)).toBe('name: "TypeError", syscall: "open", status: "400"');
    });

    it('escapes control characters in the fields', () => {
        const err = Object.assign(new Error('x'), { code: 'A\r\nB' });

        expect(describeError(err)).toBe('name: "Error", code: "A\\u000d\\u000aB"');
    });

    it('gives only the type of a value that is not an object', () => {
        expect(describeError('jane.doe@example.pt')).toBe('type: string');
        expect(describeError(undefined)).toBe('type: undefined');
        expect(describeError(null)).toBe('type: object');
    });
});
