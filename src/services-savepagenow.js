
const fetch = require('node-fetch');
const config = require('config');

module.exports = function (req, res) {
    const requestData = new URLSearchParams(req.body);
    const url = (requestData.get('url') ?? '').trim();
    const urlPattern = /^((https?:\/\/)?([a-zA-Z\d][-\w\.]+)\.([a-zA-Z\.]{2,6})([-\/\w\p{L}\.~,;:%&=?+$#*\(?\)?]*)*\/?)$/
    const startsWithHttp = /^https?:\/\//

    // Logging info:
    const userAgent = req.get('user-agent');
    const userIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    const renderError = function (errorType = 'default') {
        res.render('pages/services-savepagenow', {
            url: url,
            error: true,
            errorType: errorType
        });
        fetch(config.get('backend.url')+'/services/savepagenow?url='+encodeURIComponent(url)+'&success=false&logging=true'
        +'&user-agent='+encodeURIComponent(userAgent)+'&ip='+encodeURIComponent(userIp),{method: 'POST'});
    }
    const renderOk = function () {
        res.render('pages/services-savepagenow-save', {
            url: config.get('services.savepagenow.url') + url
        });
        fetch(config.get('backend.url')+'/services/savepagenow?url='+encodeURIComponent(url)+'&success=true&logging=true'
        +'&user-agent='+encodeURIComponent(userAgent)+'&ip='+encodeURIComponent(userIp),{method: 'POST'});
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
