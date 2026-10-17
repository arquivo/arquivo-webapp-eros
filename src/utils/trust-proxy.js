/*
 * Turns the express.trust.proxy setting (a string from config/default.properties or
 * the EXPRESS_TRUST_PROXY environment variable) into a value for Express's
 * "trust proxy" setting:
 *   empty or "false" -> false (default: req.ip is the address of the TCP peer)
 *   "true"           -> true (trust every hop; only if nothing else can reach the app)
 *   a number         -> how many proxy hops to trust, e.g. "1"
 *   anything else    -> comma-separated addresses, subnets or names such as "loopback"
 * See https://expressjs.com/en/guide/behind-proxies.html
 */
function parseTrustProxy(value) {
    const setting = String(value ?? '').trim();
    if (setting === '' || setting === 'false') return false;
    if (setting === 'true') return true;
    if (/^\d+$/.test(setting)) return Number(setting);
    return setting;
}

module.exports = { parseTrustProxy };
