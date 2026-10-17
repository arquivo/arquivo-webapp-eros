'use strict';

const config = require('config');
const escapeForLog = require('./utils/escape-for-log');

/*
 * Logs a click on a search result (analytics), one line per click with these fields,
 * tab-separated: 'ip' "user agent" 'request URL' 'tracking id' 'session id' 'timestamp'
 * 'archived URL'.
 * The IP is req.ip, the client address as derived through Express "trust proxy"
 * (express.trust.proxy), never an X-Forwarded-For header that the client may have set.
 * Control characters are escaped, so a value can't add a field or a line. As for every
 * log, retention is up to the runtime environment.
 */
module.exports = function (req, res, type) {

    // http://localhost:3000/image/view/trackingID/timestamp/archivedUrl
    const logger = require('./logger')(type+'Tracking');
    const splitPath = (req.url).split('/');
    const ipAddress = req.ip;
    const userAgent = req.get('user-agent');
    const requestUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    const trackingID = splitPath[3];
    const sessionID = req.session.id;
    const timestamp = splitPath[4];
    const archivedUrl = decodeURIComponent(splitPath[5]);

    const [ip, agent, url, tracking, session, time, archived] = [ipAddress, userAgent, requestUrl, trackingID,
        sessionID, timestamp, archivedUrl].map(escapeForLog);
    const logString = `'${ip}'\t"${agent}"\t'${url}'\t'${tracking}'\t'${session}'\t'${time}'\t'${archived}'`;
    logger.info(logString);

    res.redirect(config.get('wayback.url')+'/'+timestamp+'/'+archivedUrl);
}
