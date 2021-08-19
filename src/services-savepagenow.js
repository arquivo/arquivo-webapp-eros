
const fetch = require('node-fetch');
const config = require('config');

module.exports = function (req, res) {

    const requestData = new URLSearchParams(req.body);
    const url = (requestData.get('url') ?? '').trim();
    const urlPattern = /^((https?:\/\/)?([a-zA-Z\d][-\w\.]+)\.([a-zA-Z\.]{2,6})([-\/\w\p{L}\.~,;:%&=?+$#*\(?\)?]*)*\/?)$/
    const startsWithHttp = /^https?:\/\//
    const renderError = function (errorType = 'default') {
        res.render('pages/services-savepagenow', {
            url: url,
            error: true,
            errorType: errorType
        });
    }
    const renderOk = function () {
        res.render('pages/services-savepagenow-save', {
            url: config.get('services.savepagenow.url') + url
        });
    }

    let validUrl = !!url && urlPattern.test(url);
    if (validUrl) {
        const fetchUrl = startsWithHttp.test(url) ? url : 'https://' + url;
        fetch(fetchUrl)
            .then(res => {
                if (res.ok) {
                    renderOk();
                } else {
                    renderError('page-down');
                }
            })
            .catch(error => {
                console.error(error);
                renderError()
            })
    } else {
        renderError();
    }
}
