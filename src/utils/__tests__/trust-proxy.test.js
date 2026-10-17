const { parseTrustProxy } = require('../trust-proxy');

describe('parseTrustProxy', () => {
    it.each([
        [undefined, false],
        ['', false],
        ['  ', false],
        ['false', false],
        ['FALSE', false],
        [' False ', false],
        [false, false],
        ['1', 1],
        [2, 2],
        ['loopback', 'loopback'],
        ['10.0.0.0/8, 172.16.0.0/12', '10.0.0.0/8, 172.16.0.0/12'],
    ])('maps %p to %p', (value, expected) => {
        expect(parseTrustProxy(value)).toBe(expected);
    });

    it.each(['true', 'TRUE', ' True ', true])('refuses %p, which would trust every X-Forwarded-For entry', (value) => {
        expect(() => parseTrustProxy(value)).toThrow(/must not be "true".*number of proxy hops or the proxy addresses\/subnets/);
    });
});
