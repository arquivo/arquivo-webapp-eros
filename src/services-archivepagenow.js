
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
const https = require('https');
const config = require('config');
const isValidUrl = require('./utils/is-valid-url');
const dateToTimestamp = require('./utils/date-to-timestamp');
const logger = require('./logger')('ArchivePageNow');
const maxHops = 16; //limit to redirects
const startsWithHttp = /^https?:\/\//

/**
 * Builds the backend URL that logs an archiving attempt.
 *
 * The backend answers this request with an empty body: what gets logged is the
 * raw request line. Values are encoded with encodeURIComponent (space -> %20,
 * `( ) ! ~ *` kept literal) and not with URLSearchParams#toString (space -> +,
 * `( ) ! ~` escaped), so the logged query string stays byte-for-byte the same.
 * The URL is then normalised by `URL`, exactly as node-fetch does before sending.
 */
const buildLoggingUrl = function (params) {
    const loggingUrl = new URL(config.get('backend.url') + '/services/archivepagenow');
    loggingUrl.search = Object.entries(params)
        .map(([name, value]) => name + '=' + encodeURIComponent(value))
        .join('&');
    return loggingUrl.href;
}

module.exports = function (req, res) {
    const requestData = new URLSearchParams(req.body);
    const url = (requestData.get('url') ?? '').trim();

    // Logging info, scoped to this request:
    const userAgent = req.get('user-agent');
    const userIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    const logRequest = function (success) {
        fetch(buildLoggingUrl({ url, success, logging: true, 'user-agent': userAgent, ip: userIp }), { method: 'POST' })
            .catch(error => {
                logger.error('FetchError - ' + ['message', 'type', 'errno', 'code'].map(x => x + ': ' + JSON.stringify(error[x])).join(', '));
            });
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