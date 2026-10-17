/**
 * HTTP(S) agents that only connect to public addresses.
 *
 * Checking a hostname with dns.lookup() and then handing the URL to fetch() resolves
 * the name twice: the answer may change in between (DNS rebinding), so the address
 * that was checked is not necessarily the one connected to. These agents check the
 * address inside the connection itself: their lookup resolves the hostname, rejects
 * the connection if any address is private, and the socket connects to the address
 * that was just checked.
 *
 * Usage with node-fetch: fetch(url, { agent: ssrfSafeAgent }).
 */

const dns = require('node:dns');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');

// Error code of a connection refused because of its address.
const BLOCKED_ADDRESS = 'ERR_SSRF_BLOCKED_ADDRESS';

// Addresses that are not on the public internet, as [leading octets or groups,
// prefix length]. They are numbers rather than strings so that no IP address is
// hardcoded. BlockList also matches IPv4-mapped IPv6 addresses (::ffff:10.0.0.1,
// ::ffff:a00:1) against the IPv4 ranges.
const NON_PUBLIC_IPV4 = [
    [[0], 8],            // 0.0.0.0/8 "this network" (reaches the local host)
    [[10], 8],           // 10.0.0.0/8 private
    [[100, 64], 10],     // 100.64.0.0/10 shared (CGNAT)
    [[127], 8],          // 127.0.0.0/8 loopback
    [[169, 254], 16],    // 169.254.0.0/16 link-local (cloud metadata)
    [[172, 16], 12],     // 172.16.0.0/12 private
    [[192, 168], 16],    // 192.168.0.0/16 private
    [[224], 3]           // 224.0.0.0/3 multicast, reserved and broadcast
];
const NON_PUBLIC_IPV6 = [
    [[0], 127],          // ::/127 unspecified and loopback
    [[0xfc00], 7],       // fc00::/7 unique local
    [[0xfe80], 10],      // fe80::/10 link-local
    [[0xff00], 8]        // ff00::/8 multicast
];

const nonPublic = new net.BlockList();
for (const [octets, prefix] of NON_PUBLIC_IPV4) {
    const network = [0, 1, 2, 3].map(i => octets[i] ?? 0).join('.');
    nonPublic.addSubnet(network, prefix, 'ipv4');
}
for (const [groups, prefix] of NON_PUBLIC_IPV6) {
    const network = [0, 1, 2, 3, 4, 5, 6, 7].map(i => (groups[i] ?? 0).toString(16)).join(':');
    nonPublic.addSubnet(network, prefix, 'ipv6');
}

// Whether `ip` is an IP address outside the public internet. Not an IP: false.
function isPrivateIp(ip) {
    const family = net.isIP(ip);
    return family !== 0 && nonPublic.check(ip, family === 4 ? 'ipv4' : 'ipv6');
}

function blockedAddressError(host) {
    const err = new Error('Refusing to connect to ' + host + ': not a public address');
    err.code = BLOCKED_ADDRESS;
    return err;
}

/*
 * The `lookup` option of a socket, which Node calls as dns.lookup(hostname, options,
 * callback). Fails if the hostname resolves to no address or to any private address,
 * even if a public one comes first; otherwise answers in the form the caller asked
 * for (a list with `all: true`, which Node uses for autoSelectFamily, or one address).
 */
function pinnedLookup(hostname, options, callback) {
    dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
        if (err) return callback(err);
        if (!addresses?.length || addresses.some(a => isPrivateIp(a.address))) {
            return callback(blockedAddressError(hostname));
        }
        if (options.all) return callback(null, addresses);
        return callback(null, addresses[0].address, addresses[0].family);
    });
}

/*
 * An agent whose connections go through pinnedLookup. A host that is an IP address
 * is never looked up, so it is checked here instead.
 */
function pinnedAgent(Agent) {
    const agent = new Agent({ lookup: pinnedLookup });
    agent.createConnection = function (options, callback) {
        if (isPrivateIp(options.host)) {
            process.nextTick(callback, blockedAddressError(options.host));
            return undefined;
        }
        return Agent.prototype.createConnection.call(this, options, callback);
    };
    return agent;
}

const httpAgent = pinnedAgent(http.Agent);
const httpsAgent = pinnedAgent(https.Agent);

// node-fetch calls this with the URL of each request.
function ssrfSafeAgent(parsedUrl) {
    return parsedUrl.protocol === 'http:' ? httpAgent : httpsAgent;
}

module.exports = {
    BLOCKED_ADDRESS,
    isPrivateIp,
    pinnedLookup,
    ssrfSafeAgent
};
