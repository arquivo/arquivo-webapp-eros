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

    it('accepts the (hostname, callback) and (hostname, family, callback) forms', async () => {
        resolvesTo('93.184.216.34');

        await expect(new Promise((resolve) => pinnedLookup('example.com', (err, address) => resolve(address))))
            .resolves.toBe('93.184.216.34');
        await expect(lookup('example.com', 4)).resolves.toEqual(['93.184.216.34', 4]);
        expect(dns.lookup).toHaveBeenLastCalledWith('example.com', { family: 4, all: true }, expect.any(Function));
    });

    it.each(['127.0.0.1', '10.0.0.1', '169.254.169.254', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1'])(
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
