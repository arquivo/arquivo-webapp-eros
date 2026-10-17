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

// Addresses that are not on the public internet: "this network" (0.0.0.0, which
// reaches the local host), private (RFC 1918), shared (CGNAT), loopback, link-local
// (cloud metadata), multicast and reserved; for IPv6 the unspecified address,
// loopback, unique local, link-local and multicast. BlockList also matches
// IPv4-mapped IPv6 addresses (::ffff:10.0.0.1, ::ffff:a00:1) against the IPv4 ranges.
const nonPublic = new net.BlockList();
for (const [network, prefix] of [
    ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
    ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.168.0.0', 16], ['224.0.0.0', 3]
]) {
    nonPublic.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]]) {
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
 * Same signature as dns.lookup(), so it can be the `lookup` option of a socket.
 * Fails if the hostname resolves to no address or to any private address, even if
 * a public one comes first; otherwise answers in the form the caller asked for
 * (a list with `all: true`, which Node uses for autoSelectFamily, or one address).
 */
function pinnedLookup(hostname, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    } else if (typeof options === 'number') {
        options = { family: options };
    }
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
        const host = options.host ?? '';
        const ip = host.startsWith('[') ? host.slice(1, -1) : host;
        if (net.isIP(ip) && isPrivateIp(ip)) {
            process.nextTick(callback, blockedAddressError(host));
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
