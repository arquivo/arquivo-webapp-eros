
const config = require('config');
const fetch = require('node-fetch');
const PageSearchApiRequest = require('./apis/page-search-api');
const logger = require('./logger')('Wayback');

function sanitizeUrl(url) {
    let result = url.replace(/(^\/+)|(\/+$)/g, '');
    while (result.includes('//')) {
        result = result.replace('//', '/');
    }
    return result;
}

module.exports = function wayback(req, res) {
    function renderOk(fullUrl) {
        //rewrite user URL if needed
        if (sanitizeUrl(fullUrl) === sanitizeUrl(req.url.slice('/wayback'.length))) {
            const timestamp = fullUrl.split('/')[0];
            const url = fullUrl.split('/').filter((a, i) => i > 0).join('/');

            if (!/^\d+$/.test(timestamp)) {
                const newUrl = config.get('pywb.url') + '/' + timestamp + '/' + url;
                res.redirect(newUrl);
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
        } else {
            res.redirect('/wayback/' + fullUrl);
        }
    }
    function renderError() {
        res.status(404).render('pages/arquivo-404');
    }
    const splitToken = config.get('pywb.url').split('/').pop() + '/'; //'noFrame/' ou 'replay/'
    function testUrl(url) {
        fetch(url) // NOSONAR - intentional: proxying to configured pywb backend
            .then(result => {
                const newUrl = result.url.split(splitToken).filter((a, i) => i > 0).join(splitToken);
                if (sanitizeUrl(result.url) != sanitizeUrl(url)) {
                    const fullUrl = config.get('pywb.url') + '/' + newUrl;
                    testUrl(fullUrl);
                } else if (result.ok) {
                    renderOk(newUrl);
                } else {
                    logger.error('Something went wrong while trying to fetch the following URL: '+url); // NOSONAR
                    renderError();
                }
            }).
            catch(error => {
                logger.error('Failed to fetch the following URL: '+url); // NOSONAR
                logger.error(error);
                renderError();
            });
    }

    const noFrameUrl = config.get('pywb.url') + req.url.slice('/wayback'.length)
    testUrl(noFrameUrl);
}
