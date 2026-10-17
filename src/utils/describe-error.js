'use strict';

const escapeForLog = require('./escape-for-log');

const FIELDS = ['name', 'type', 'code', 'errno', 'syscall', 'status'];

/**
 * Describes an error for a log line by its name and codes, without its message, which may
 * hold user input: node-fetch puts the requested URL in it, an API may quote the values it
 * got. Log the message (or the stack) at debug level only, with escapeForLog.
 *
 * @param {*} err - The error
 * @returns {string} E.g. 'name: "FetchError", type: "system", code: "ECONNREFUSED"', or
 *   'name: "HTTPError", response status: 403'
 */
module.exports = function describeError(err) {
    if (err === null || typeof err !== 'object') {
        return 'type: ' + typeof err;
    }
    const parts = FIELDS.filter(field => err[field] != null && typeof err[field] !== 'object')
        .map(field => field + ': "' + escapeForLog(err[field]) + '"');
    // The HTTP status of an error that keeps the response, e.g. ky's HTTPError (Google Sheets)
    if (typeof err.response?.status === 'number') {
        parts.push('response status: ' + err.response.status);
    }
    return parts.length > 0 ? parts.join(', ') : 'type: object';
};
