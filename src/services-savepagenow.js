
const fetch = require('node-fetch');
const https = require('https');
const config = require('config');
const isValidUrl = require('./utils/is-valid-url');
const dateToTimestamp = require('./utils/date-to-timestamp');
const logger = require('./logger')('SavePageNow');
const maxHops = 16; //limit to redirects
const startsWithHttp = /^https?:\/\//

let userAgent = ''
let userIp = ''

module.exports = function (req, res) {
    const requestData = new URLSearchParams(req.body);
    const url = (requestData.get('url') ?? '').trim();

    // Logging info:
    userAgent = req.get('user-agent');
    userIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    const renderError = function (errorType = 'default') {
        res.render('pages/services-savepagenow', {
            url: url,
            error: true,
            errorType: errorType
        });
        fetch(config.get('backend.url') + '/services/savepagenow?url=' + encodeURIComponent(url) + '&success=false&logging=true'
            + '&user-agent=' + encodeURIComponent(userAgent) + '&ip=' + encodeURIComponent(userIp), { method: 'POST' })
            .catch(error => {
                logger.error('FetchError - ' + ['message', 'type', 'errno', 'code'].map(x => x + ': ' + JSON.stringify(error[x])).join(', '));
            });
    }
    const renderOk = function () {
        res.render('pages/services-savepagenow-save', {
            url: config.get('services.savepagenow.url') + url,
            recordingUrl: config.get('wayback.url') + '/' + dateToTimestamp(new Date()) + '/' + url,
            liveUrl: url
        });
        fetch(config.get('backend.url') + '/services/savepagenow?url=' + encodeURIComponent(url) + '&success=true&logging=true'
            + '&user-agent=' + encodeURIComponent(userAgent) + '&ip=' + encodeURIComponent(userIp), { method: 'POST' })
            .catch(error => {
                logger.error('FetchError - ' + ['message', 'type', 'errno', 'code'].map(x => x + ': ' + JSON.stringify(error[x])).join(', '));
            });
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