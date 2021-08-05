
const config = require('config');
const fetch = require('node-fetch');
module.exports = function (req, res) {
    function renderOk() {
        const fullUrl = req.params.url + (req.params['0'] ?? '');
        const timestamp = fullUrl.split('/')[0];
        const url = fullUrl.split('/').filter((a, i) => i > 0).join('/');

        res.render('pages/replay', {
            requestedPage: {
                fullUrl: fullUrl,
                url: url,
                timestamp: timestamp
            },
            requestData: new URLSearchParams({ l: req.getLanguage() })
        });
    }
    function renderError() {
        res.status(404).render('pages/arquivo-404');
    }
    function testUrl(url) {
        fetch(url)
        .then(res => {
            if (res.url.replace(/^\/+|\/+$/g, '') != url.replace(/^\/+|\/+$/g, '')) {
                const newUrl = config.get('noFrame.replay.url') + res.url.split('replay').filter((a, i) => i > 0).join('replay');
                testUrl(newUrl);
            } else if (res.ok) {
                renderOk();
            } else {
                renderError();
            }
        })
    }

    const noFrameUrl = config.get('noFrame.replay.url') + '/' + req.params.url + (req.params['0'] ?? '')
    testUrl(noFrameUrl);
}
