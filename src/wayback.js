
const config = require('config');
const fetch = require('node-fetch');
const PageSearchApiRequest = require('./apis/page-search-api');
const logger = require('./logger')('Wayback');
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
            const url = fullUrl.split('/').filter((a, i) => i > 0).join('/');

            if(/^\d+$/.test(timestamp) == false){
                newUrl = config.get('pywb.url') + '/' + timestamp + '/' + url;
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
        }
    }
    function renderError() {
        res.status(404).render('pages/arquivo-404');
    }
    const splitToken = config.get('pywb.url').split('/').pop() + '/'; //'noFrame/' ou 'replay/' 
    function testUrl(url) {
        fetch(url)
            .then(res => {
                const newUrl = res.url.split(splitToken).filter((a, i) => i > 0).join(splitToken);
                if (sanitizeUrl(res.url) != sanitizeUrl(url)) {
                    const fullUrl = config.get('pywb.url') + '/' + newUrl;
                    testUrl(fullUrl);
                } else if (res.ok) {


                    renderOk(newUrl);
                } else {
                    logger.error('Something went wrong while trying to fetch the following URL: '+url);
                    renderError();
                }
            }).
            catch(error => {
                logger.error('Failed to fetch the following URL: '+url);
                logger.error(error);
                renderError();
            });
    }

    const noFrameUrl = config.get('pywb.url') + req.url.slice('/wayback'.length)
    testUrl(noFrameUrl);
}
