
/**
 * Archive Page Now Service
 * 
 * Handles requests to archive a web page immediately. This service:
 * 1. Validates the submitted URL
 * 2. Renders success page with links to:
 *    - The archiving service URL
 *    - The recorded version in Wayback (with current timestamp)
 *    - The original live URL
 * 3. Logs the archiving request to backend with user-agent and IP
 * 
 * On validation failure, renders error page and logs the failed attempt.
 * All logging includes user-agent and IP for tracking purposes.
 */

const fetch = require('node-fetch');
const config = require('config');
const isValidUrl = require('./utils/is-valid-url');
const dateToTimestamp = require('./utils/date-to-timestamp');
const logger = require('./logger')('ArchivePageNow');

/**
 * The backend endpoint that logs an archiving attempt, built from config only
 * (no request data). `URL` only normalises it; it throws synchronously on a
 * malformed backend.url, so callers must catch.
 */
const loggingEndpoint = function () {
    return new URL(config.get('backend.url') + '/services/archivepagenow').href;
}

module.exports = function (req, res) {
    const requestData = new URLSearchParams(req.body);
    const url = (requestData.get('url') ?? '').trim();

    // Logging info, scoped to this request:
    const userAgent = req.get('user-agent');
    const userIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Never log error.message: node-fetch puts the full request URL in it, i.e.
    // backend.url (which may hold credentials) plus the user's URL, UA and IP.
    const logError = function (error) {
        logger.error('Backend logging failed - ' + ['name', 'type', 'errno', 'code'].map(x => x + ': ' + JSON.stringify(error[x])).join(', '));
    }
    // Logging is fail-safe: it runs after the page has been rendered, so neither
    // a rejected fetch nor a synchronous throw (e.g. `new URL` on a malformed
    // backend.url) may escape to Express; both go to the app logger instead.
    const logRequest = function (success) {
        try {
            // Each request value is encoded right where it is appended to the
            // fixed endpoint, so the host and path can only come from config.
            // The backend answers with an empty body: what gets logged is the
            // raw request line. encodeURIComponent (space -> %20, `( ) ! ~ *`
            // literal) keeps the logged request line in its existing format;
            // URLSearchParams would not (space -> +, `( ) ! ~` escaped).
            fetch(loggingEndpoint()
                + '?url=' + encodeURIComponent(url)
                + '&success=' + success
                + '&logging=true'
                + '&user-agent=' + encodeURIComponent(userAgent)
                + '&ip=' + encodeURIComponent(userIp), { method: 'POST' })
                .catch(logError);
        } catch (error) {
            if (error.code === 'ERR_INVALID_URL') {
                // Never log the value (error.input): backend.url may hold credentials.
                logger.error('Invalid backend.url configuration');
            } else {
                logError(error);
            }
        }
    }
    const renderError = function (errorType = 'default') {
        res.render('pages/services-archivepagenow', {
            url: url,
            error: true,
            errorType: errorType
        });
        logRequest(false);
    }
    const renderOk = function () {
        res.render('pages/services-archivepagenow-save', {
            url: config.get('services.archivepagenow.url') + url,
            recordingUrl: config.get('wayback.url') + '/' + dateToTimestamp(new Date()) + '/' + url,
            liveUrl: url
        });
        logRequest(true);
    }
    const processUrl = function (url) {
        if (isValidUrl(url)) {
            renderOk();
        } else {
            logger.error('Invalid Url: ' + url);
            renderError();
        }
    }

    logger.info('Accessing requested page: ' + url);
    processUrl(url);

}