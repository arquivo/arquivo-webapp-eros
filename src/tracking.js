const config = require('config');
module.exports = function (req, res, type) {

    // http://localhost:3000/image/view/trackingID/timestamp/archivedUrl
    const logger = require('./logger')(type+'Tracking');
    const splitPath = (req.url).split('/');
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.get('user-agent');
    const requestUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    const trackingID = splitPath[3];
    const sessionID = req.session.id;
    const timestamp = splitPath[4];
    const archivedUrl = decodeURIComponent(splitPath[5]);

    const logString = `'${ipAddress}'\t"${userAgent}"\t'${requestUrl}'\t'${trackingID}'\t'${sessionID}'\t'${timestamp}'\t'${archivedUrl}'`;
    logger.info(logString);

    res.redirect(config.get('wayback.url')+'/'+timestamp+'/'+archivedUrl);
}