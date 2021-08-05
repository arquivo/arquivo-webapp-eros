
const config = require('config');
const fetch = require('node-fetch');
const PageSearchApiRequest = require('./apis/page-search-api');
module.exports = function (req, res) {
    function renderOk(fullUrl) {

        //rewrite user URL if needed
        if (fullUrl.replace(/^\/+|\/+$/g, '') != (req.params.url + (req.params['0'] ?? '')).replace(/^\/+|\/+$/g, '')) {
            res.redirect('/wayback/' + fullUrl);
        } else {
            const timestamp = fullUrl.split('/')[0];
            const url = fullUrl.split('/').filter((a, i) => i > 0).join('/');

            //Api request for technical details.
            const apiRequest = new PageSearchApiRequest();
            const apiRequestData = new URLSearchParams({
                metadata: url + '/' + timestamp
            })

            apiRequest.get(apiRequestData,
                (apiData) => {
                    res.render('pages/replay', {
                        requestData: new URLSearchParams({ l: req.getLanguage() }),
                        apiData: apiData.response_items[0],
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
    function testUrl(url) {
        fetch(url)
            .then(res => {
                const newUrl = res.url.split('replay/').filter((a, i) => i > 0).join('replay');
                if (res.url.replace(/^\/+|\/+$/g, '') != url.replace(/^\/+|\/+$/g, '')) {
                    const fullUrl = config.get('noFrame.replay.url') + '/' + newUrl;
                    testUrl(fullUrl);
                } else if (res.ok) {
                    renderOk(newUrl);
                } else {
                    renderError();
                }
            })
    }

    const noFrameUrl = config.get('noFrame.replay.url') + '/' + req.params.url + (req.params['0'] ?? '')
    testUrl(noFrameUrl);
}
