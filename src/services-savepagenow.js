
const fetch = require('node-fetch');
const https = require('https');
const config = require('config');
const isValidUrl = require('./utils/is-valid-url');
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
            + '&user-agent=' + encodeURIComponent(userAgent) + '&ip=' + encodeURIComponent(userIp), { method: 'POST' });
    }
    const renderOk = function () {
        res.render('pages/services-savepagenow-save', {
            url: config.get('services.savepagenow.url') + url
        });
        fetch(config.get('backend.url') + '/services/savepagenow?url=' + encodeURIComponent(url) + '&success=true&logging=true'
            + '&user-agent=' + encodeURIComponent(userAgent) + '&ip=' + encodeURIComponent(userIp), { method: 'POST' });
    }
    const processUrl = function (url,hops=0) {
        if(hops > maxHops){
            logger.error('Error - Too many redirects ('+ hops +')');
            renderError('communication-failure');
            return;
        }
        if (isValidUrl(url)) {
            const fetchUrl = startsWithHttp.test(url) ? url : 'https://' + url;
            const fetchConfigs = { redirect: 'manual' }

            if (fetchUrl.toLowerCase().startsWith('https://')) {
                fetchConfigs['agent'] = new https.Agent({
                    rejectUnauthorized: false,
                });
            }

            fetch(fetchUrl, fetchConfigs)
                .then(res => {
                    if (res.status === 301 || res.status === 302) {
                        const locationURL = '' + new URL(res.headers.get('location'), res.url);
                        logger.info('Found status ' + res.status + '. Redirecting to ' + locationURL);
                        processUrl(locationURL,hops+1);
                    } else if (res.ok) {
                        renderOk();
                    } else {
                        logger.error('The webpage is down: ' + res.url + ' Status: ' + res.status + ' ' + res.statusText);
                        renderError('page-down');
                    }
                })
                .catch(error => {
                    logger.error('FetchError - ' + ['message', 'type', 'errno', 'code'].map(x => x + ': ' + JSON.stringify(error[x])).join(', '));
                    renderError('communication-failure');
                })
        } else {
            logger.error('Invalid Url: ' + url);
            renderError();
        }
    }

    logger.info('Accessing requested page: ' + url);
    processUrl(url);

}