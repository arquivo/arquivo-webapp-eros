const config = require('config');

module.exports = function (app) {
    
    const handledRoutes = [
        '/wayback/cdx',
        '/wayback/timemap'
    ]
    
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
