'use strict';

/*
 * Turns the express.trust.proxy setting (a string from config/default.properties or
 * the EXPRESS_TRUST_PROXY environment variable) into a value for Express's
 * "trust proxy" setting:
 *   empty or "false" -> false (default: req.ip is the address of the TCP peer)
 *   a number         -> how many proxy hops to trust, e.g. "1"
 *   anything else    -> comma-separated addresses, subnets or names such as "loopback"
 * "true" is refused: Express would then take the leftmost X-Forwarded-For entry,
 * which the client sets even behind a proxy that appends to the header.
 * See https://expressjs.com/en/guide/behind-proxies.html
 */
// Returns false, a number or a string on purpose: Express takes each as is, and express-rate-limit
// checks for exactly false to report an unexpected X-Forwarded-For header.
function parseTrustProxy(value) { // NOSONAR: javascript:S3800, see above
    const setting = String(value ?? '').trim();
    const lowerCase = setting.toLowerCase();
    if (lowerCase === '' || lowerCase === 'false') return false;
    if (lowerCase === 'true') {
        throw new Error('Configuration property "express.trust.proxy" (EXPRESS_TRUST_PROXY) must not be "true", '
            + 'which lets any client set its IP with X-Forwarded-For: use the number of proxy hops '
            + 'or the proxy addresses/subnets instead');
    }
    if (/^\d+$/.test(setting)) return Number(setting);
    return setting;
}

module.exports = { parseTrustProxy };
