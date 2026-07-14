
const config = require('config');
const PageSearchApiRequest = require('./apis/page-search-api');
const logger = require('./logger')('Wayback');

module.exports = function (req, res) {
    const reqPath = req.url.slice('/wayback'.length).replace(/^\//, '');
    const parts = reqPath.split('/');
    const timestamp = parts[0];
    const url = parts.slice(1).join('/');

    if (!timestamp || !url) {
        return res.status(404).render('pages/arquivo-404');
    }

    // Strip pywb modifiers from timestamp (e.g. 20220907152857mp_ → 20220907152857)
    const cleanTimestamp = timestamp.replace(/\D.*$/, '');
    if (cleanTimestamp !== timestamp) {
        return res.redirect('/wayback/' + cleanTimestamp + '/' + url);
    }

    const apiRequest = new PageSearchApiRequest();
    apiRequest.get(
        new URLSearchParams({ metadata: url + '/' + timestamp }),
        (apiData) => {
            const data = apiData.response_items ? apiData.response_items[0] : {};
            res.render('pages/replay', {
                requestData: new URLSearchParams({ l: req.getLanguage() }),
                apiData: data,
                requestedPage: {
                    fullUrl: timestamp + '/' + url,
                    url: url,
                    timestamp: timestamp,
                },
            });
        }
    );
}
