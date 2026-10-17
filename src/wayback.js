'use strict';

const config = require('config');
const fetch = require('node-fetch');
const PageSearchApiRequest = require('./apis/page-search-api');
const logger = require('./logger')('Wayback');
const textAfterFirst = require('./utils/text-after-first');
const escapeForLog = require('./utils/escape-for-log');
const describeError = require('./utils/describe-error');
module.exports = function (req, res) {
    function sanitizeUrl(url){
        let res = url.replace(/(^\/+)|(\/+$)/g, '');
        while(res.includes('//')){
            res = res.replace('//','/');
        }
        return res;
    }
    function renderOk(fullUrl) {
        //rewrite user URL if needed
        if (sanitizeUrl(fullUrl) != sanitizeUrl(req.url.slice('/wayback'.length))) {
            res.redirect('/wayback/' + fullUrl);
        } else {
            const timestamp = fullUrl.split('/')[0];
            const url = textAfterFirst(fullUrl, '/');

            if(/^\d+$/.test(timestamp) == false){
                const newUrl = config.get('pywb.url') + '/' + timestamp + '/' + url;
                res.redirect(newUrl);
                return;
            }

            //Api request for technical details.
            const apiRequest = new PageSearchApiRequest();
            const apiRequestData = new URLSearchParams({
                metadata: url + '/' + timestamp
            })

            apiRequest.get(apiRequestData,
                (apiData) => {
                    const data = apiData.response_items ? apiData.response_items[0] : {};
                    res.render('pages/replay', {
                        requestData: new URLSearchParams({ l: req.getLanguage() }),
                        apiData: data,
                        requestedPage: {
                            fullUrl: fullUrl,
                            url: url,
                            timestamp: timestamp
                        },
                    });
                });
        }
    }
    function renderError() {
        res.status(404).render('pages/arquivo-404');
    }
    const splitToken = config.get('pywb.url').split('/').pop() + '/'; //'noFrame/' ou 'replay/' 
    function testUrl(url) {
        fetch(url)
            .then(res => {
                const newUrl = textAfterFirst(res.url, splitToken);
                if (sanitizeUrl(res.url) != sanitizeUrl(url)) {
                    const fullUrl = config.get('pywb.url') + '/' + newUrl;
                    testUrl(fullUrl);
                } else if (res.ok) {


                    renderOk(newUrl);
                } else {
                    // The URL tells which page the user is reading: debug only.
                    logger.error('Something went wrong while trying to fetch the replay URL. Status: ' + res.status);
                    logger.debug('Replay URL: ' + escapeForLog(url));
                    renderError();
                }
            }).
            catch(error => {
                // The error message quotes the URL: debug only.
                logger.error('Failed to fetch the replay URL. Reason: ' + describeError(error));
                logger.debug('Failed to fetch ' + escapeForLog(url) + ': ' + escapeForLog(error?.stack ?? error));
                renderError();
            });
    }

    const noFrameUrl = config.get('pywb.url') + req.url.slice('/wayback'.length)
    testUrl(noFrameUrl);
}
