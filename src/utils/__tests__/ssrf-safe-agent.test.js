'use strict';

// No test here reaches the network: every lookup is answered by the dns mock, and
// connections that would pass the checks are stopped at createConnection.
jest.mock('node:dns');

const dns = require('node:dns');
const http = require('node:http');
const https = require('node:https');
const { BLOCKED_ADDRESS, isPrivateIp, pinnedLookup, ssrfSafeAgent } = require('../ssrf-safe-agent');

function resolvesTo(...addresses) {
    dns.lookup.mockImplementation((hostname, opts, cb) => cb(null, addresses.map(address => ({
        address,
        family: address.includes(':') ? 6 : 4
    }))));
}

function lookup(hostname, options) {
    return new Promise((resolve, reject) => {
        pinnedLookup(hostname, options, (err, ...result) => (err ? reject(err) : resolve(result)));
    });
}

function request(module, url) {
    return new Promise((resolve, reject) => {
        const req = module.request(url, { method: 'HEAD', agent: ssrfSafeAgent(new URL(url)) }, resolve);
        req.on('error', reject);
        req.end();
    });
}

beforeEach(() => {
    jest.resetAllMocks();
});

describe('isPrivateIp', () => {
    it.each([
        '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254',
        '0.0.0.0', '100.64.0.1', '224.0.0.1', '255.255.255.255',
        '::', '::1', '0:0:0:0:0:0:0:1', 'fc00::1', 'fd12:3456::1', 'FE80::1', 'ff02::1',
        '::ffff:192.168.1.1', '::FFFF:127.0.0.1', '::ffff:a00:1', '::ffff:0.0.0.0'
    ])('treats %s as private', (ip) => {
        expect(isPrivateIp(ip)).toBe(true);
    });

    it.each(['93.184.216.34', '172.32.0.1', '100.128.0.1', '2001:4860:4860::8888', '::ffff:8.8.8.8', '::ffff:808:808', 'example.com', ''])(
        'treats %s as public', (ip) => {
            expect(isPrivateIp(ip)).toBe(false);
        });
});

describe('isPrivateIp, reserved and IPv6 transition/translation ranges', () => {
    // Each range with addresses at its edges and, where the neighbour is public, the
    // nearest addresses outside it.
    it.each([
        ['192.0.0.0/24', ['192.0.0.0', '192.0.0.255'], ['191.255.255.255', '192.0.1.0']],
        ['192.0.2.0/24', ['192.0.2.0', '192.0.2.255'], ['192.0.1.255', '192.0.3.0']],
        ['192.88.99.0/24', ['192.88.99.0', '192.88.99.255'], ['192.88.98.255', '192.88.100.0']],
        ['198.18.0.0/15', ['198.18.0.0', '198.19.255.255'], ['198.17.255.255', '198.20.0.0']],
        ['198.51.100.0/24', ['198.51.100.0', '198.51.100.255'], ['198.51.99.255', '198.51.101.0']],
        ['203.0.113.0/24', ['203.0.113.0', '203.0.113.255'], ['203.0.112.255', '203.0.114.0']],
        ['::ffff:192.0.2.0/120 (IPv4-mapped)', ['::ffff:192.0.2.1', '::ffff:c612:1'], ['::ffff:192.0.3.0']],
        ['::/96', ['::8.8.8.8', '::ffff:ffff'], ['::1:0:0']],
        ['::ffff:0:0:0/96', ['::ffff:0:0:0', '::ffff:0:808:808', '::ffff:0:ffff:ffff'], ['::fffe:ffff:ffff:ffff', '::ffff:1:0:0']],
        ['64:ff9b:1::/48', ['64:ff9b:1::', '64:ff9b:1:ffff:ffff:ffff:ffff:ffff'], ['64:ff9b:0:ffff:ffff:ffff:ffff:ffff', '64:ff9b:2::']],
        ['2001::/32', ['2001::', '2001:0:ffff:ffff:ffff:ffff:ffff:ffff'], ['2000:ffff:ffff:ffff:ffff:ffff:ffff:ffff', '2001:1::']],
        ['2002::/16', ['2002::', '2002:ffff:ffff:ffff:ffff:ffff:ffff:ffff'], ['2003::']],
        // Between fe80::/10 (link-local) and ff00::/8 (multicast): no public neighbour.
        ['fec0::/10', ['fec0::', 'FEFF:ffff:ffff:ffff:ffff:ffff:ffff:ffff'], []]
    ])('%s', (range, inside, outside) => {
        for (const ip of inside) expect([ip, isPrivateIp(ip)]).toEqual([ip, true]);
        for (const ip of outside) expect([ip, isPrivateIp(ip)]).toEqual([ip, false]);
    });

    describe('64:ff9b::/96 (NAT64), judged by the IPv4 address in its last 32 bits', () => {
        it.each(['64:ff9b::8.8.8.8', '64:ff9b::808:808', '64:FF9B::5DB8:D822', '64:ff9b::dfff:ffff'])(
            'allows %s (public IPv4 address)', (ip) => {
                expect(isPrivateIp(ip)).toBe(false);
            });

        it.each([
            '64:ff9b::', '64:ff9b::1', '64:ff9b::1:0', '64:ff9b::10.0.0.1', '64:ff9b::a00:1', '64:ff9b::7f00:1',
            '64:ff9b::a9fe:a9fe', '64:FF9B::C0A8:101', '64:ff9b::c000:201', '64:ff9b::e000:0', '64:ff9b::a00:1%eth0'
        ])('blocks %s (non-public IPv4 address)', (ip) => {
            expect(isPrivateIp(ip)).toBe(true);
        });

        it('does not decode an address just outside the prefix', () => {
            expect(isPrivateIp('64:ff9b:0:0:0:1:a00:1')).toBe(false);
        });
    });
});

describe('pinnedLookup', () => {
    it('answers with the first address when one address is asked for', async () => {
        resolvesTo('93.184.216.34', '2001:4860:4860::8888');

        await expect(lookup('example.com', {})).resolves.toEqual(['93.184.216.34', 4]);
        expect(dns.lookup).toHaveBeenCalledWith('example.com', { all: true }, expect.any(Function));
    });

    it('answers with every address when all are asked for', async () => {
        resolvesTo('93.184.216.34', '2001:4860:4860::8888');

        await expect(lookup('example.com', { all: true, family: 0 })).resolves.toEqual([[
            { address: '93.184.216.34', family: 4 },
            { address: '2001:4860:4860::8888', family: 6 }
        ]]);
    });

    // isPrivateIp's own table covers the ranges; these cover the lookup path.
    it.each(['10.0.0.1', 'fd00::1'])(
        'rejects a hostname resolving to %s', async (address) => {
            resolvesTo(address);

            await expect(lookup('internal.example.com', {})).rejects.toMatchObject({ code: BLOCKED_ADDRESS });
        });

    it('rejects a hostname resolving to a public address first and a private one second', async () => {
        resolvesTo('93.184.216.34', '10.0.0.1');

        await expect(lookup('rebind.example.com', {})).rejects.toMatchObject({ code: BLOCKED_ADDRESS });
        await expect(lookup('rebind.example.com', { all: true })).rejects.toMatchObject({ code: BLOCKED_ADDRESS });
    });

    it('rejects a hostname resolving to no address', async () => {
        resolvesTo();

        await expect(lookup('empty.example.com', {})).rejects.toMatchObject({ code: BLOCKED_ADDRESS });
    });

    it('passes DNS errors through', async () => {
        const err = Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' });
        dns.lookup.mockImplementation((hostname, opts, cb) => cb(err));

        await expect(lookup('missing.example.com', {})).rejects.toBe(err);
    });
});

describe('ssrfSafeAgent', () => {
    it('picks the agent for the protocol', () => {
        expect(ssrfSafeAgent(new URL('http://example.com/'))).toBeInstanceOf(http.Agent);
        expect(ssrfSafeAgent(new URL('https://example.com/'))).toBeInstanceOf(https.Agent);
        expect(ssrfSafeAgent(new URL('https://example.com/'))).toBe(ssrfSafeAgent(new URL('https://other.example.com/')));
    });

    it.each([
        [http, 'http://internal.example.com/'],
        [https, 'https://internal.example.com/']
    ])('refuses the connection when the hostname resolves to a private address (%#)', async (module, url) => {
        resolvesTo('192.168.1.1');

        await expect(request(module, url)).rejects.toMatchObject({ code: BLOCKED_ADDRESS });
        expect(dns.lookup).toHaveBeenCalledWith('internal.example.com', expect.objectContaining({ all: true }), expect.any(Function));
    });

    it('checks the lookup made for the connection, not an earlier one (DNS rebinding)', async () => {
        // A first lookup (e.g. an earlier check) sees a public address, the connection's sees a private one.
        dns.lookup
            .mockImplementationOnce((hostname, opts, cb) => cb(null, [{ address: '93.184.216.34', family: 4 }]))
            .mockImplementationOnce((hostname, opts, cb) => cb(null, [{ address: '127.0.0.1', family: 4 }]));
        await expect(lookup('rebind.example.com', {})).resolves.toEqual(['93.184.216.34', 4]);

        await expect(request(https, 'https://rebind.example.com/')).rejects.toMatchObject({ code: BLOCKED_ADDRESS });
    });

    it.each([
        [http, 'http://127.0.0.1/'],
        [http, 'http://[::1]/'],
        [https, 'https://169.254.169.254/'],
        [https, 'https://[::ffff:10.0.0.1]/'],
        [http, 'http://0.0.0.0/']
    ])('refuses a private IP address host (%#)', async (module, url) => {
        await expect(request(module, url)).rejects.toMatchObject({ code: BLOCKED_ADDRESS });
        expect(dns.lookup).not.toHaveBeenCalled();
    });

    describe('when the address is public', () => {
        let createConnection;

        beforeEach(() => {
            // Stop the connection where it would open a socket.
            createConnection = jest.spyOn(http.Agent.prototype, 'createConnection')
                .mockImplementation((options, cb) => {
                    process.nextTick(cb, Object.assign(new Error('stopped'), { code: 'STOPPED' }));
                });
        });

        afterEach(() => {
            createConnection.mockRestore();
        });

        it('connects through pinnedLookup', async () => {
            await expect(request(http, 'http://example.com/')).rejects.toMatchObject({ code: 'STOPPED' });
            expect(createConnection).toHaveBeenCalledWith(
                expect.objectContaining({ host: 'example.com', lookup: pinnedLookup }),
                expect.any(Function)
            );
        });

        it('connects to a public IP address host', async () => {
            await expect(request(http, 'http://93.184.216.34/')).rejects.toMatchObject({ code: 'STOPPED' });
            expect(createConnection).toHaveBeenCalledWith(
                expect.objectContaining({ host: '93.184.216.34' }),
                expect.any(Function)
            );
        });
    });
});
