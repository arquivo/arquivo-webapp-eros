const { parseTrustProxy } = require('../trust-proxy');

describe('parseTrustProxy', () => {
    it.each([
        [undefined, false],
        ['', false],
        ['  ', false],
        ['false', false],
        [false, false],
        ['true', true],
        [true, true],
        ['1', 1],
        [2, 2],
        ['loopback', 'loopback'],
        ['10.0.0.0/8, 172.16.0.0/12', '10.0.0.0/8, 172.16.0.0/12'],
    ])('maps %p to %p', (value, expected) => {
        expect(parseTrustProxy(value)).toBe(expected);
    });
});
