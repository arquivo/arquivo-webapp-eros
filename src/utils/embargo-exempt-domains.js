'use strict';

const { domainToASCII } = require('node:url');

const SETTING = 'Configuration property "embargo.exempt.domains" (EMBARGO_EXEMPT_DOMAINS)';
// Letters (any script), digits, dots and hyphens: domainToASCII alone drops or maps some
// other characters (e.g. a trailing "/") instead of refusing them
const DOMAIN_CHARACTERS = /^[\p{L}\p{M}\p{N}.-]+$/u;
// A DNS label in ASCII (internationalised names are converted to punycode first)
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/*
 * Turns the embargo.exempt.domains setting (a comma-separated string from
 * config/default.properties or the EMBARGO_EXEMPT_DOMAINS environment variable) into a
 * list of lower-case ASCII domains. Empty means no exemptions.
 * Throws on anything that is not a domain name with at least two labels: "*", "pt",
 * empty entries, URLs, IP addresses. One mistake must not lift the embargo on more
 * than intended, so the app refuses to start instead.
 */
function parseEmbargoExemptDomains(value) {
    const setting = String(value ?? '').trim();
    if (setting === '') return [];
    return setting.split(',').map((entry) => {
        const domain = DOMAIN_CHARACTERS.test(entry.trim()) ? domainToASCII(entry.trim()) : '';
        const labels = domain.split('.');
        if (domain.length > 253 || labels.length < 2 || !labels.every(label => LABEL.test(label))
            // Top-level domains are never all digits: this refuses IP addresses
            || /^\d+$/.test(labels.at(-1))) {
            throw new Error(SETTING + ' must be a comma-separated list of domain names, such as '
                + '"blogs.sapo.pt": "' + entry.trim() + '" is not one');
        }
        return domain;
    });
}

/*
 * Whether the host of the given capture URL is one of the domains or a subdomain of one.
 * The URL parser gives the host in lower case and punycode, without user info or port;
 * a URL it can't parse is not exempt.
 */
function isEmbargoExempt(url, domains) {
    if (domains.length === 0) return false;
    let hostname;
    try {
        hostname = new URL(url).hostname.replace(/\.$/, '');
    } catch {
        return false;
    }
    return domains.some(domain => hostname === domain || hostname.endsWith('.' + domain));
}

module.exports = { parseEmbargoExemptDomains, isEmbargoExempt };
