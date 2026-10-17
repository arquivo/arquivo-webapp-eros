/**
 * Backend Routes - PyWb redirects
 *
 * GET /wayback/cdx and /wayback/timemap (with or without a URL path after them)
 * are redirected to the PyWb backend: transformUrl() strips 'wayback' from the
 * request URL and puts the configured pywb.url (by default
 * ${backend.url}/noFrame/replay, see config/default.properties) in front of it.
 *
 * Example, with backend.url = https://arquivo.pt:
 *   Request:   /wayback/cdx?url=example.com
 *   Redirect:  https://arquivo.pt/noFrame/replay/cdx?url=example.com
 */

const config = require('config');

module.exports = function (app) {
    
    const handledRoutes = [
        '/wayback/cdx',
        '/wayback/timemap'
    ]
    
    // The request URL without 'wayback', prefixed with pywb.url
    function transformUrl (req,token='wayback'){
        return config.get('pywb.url') + req.originalUrl.split(token).filter((x,i) => i>0).join('');
    }

    handledRoutes.forEach(route => {
        app.get(route+'/:url*',function(req, res) {
            res.redirect(transformUrl(req));
        })
        app.get(route,function(req, res) {
            res.redirect(transformUrl(req));
        })
    })
}
