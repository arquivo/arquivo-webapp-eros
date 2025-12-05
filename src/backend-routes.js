/**
 * Backend Routes - PyWb Proxy/Redirect Layer
 * 
 * Serves as a proxy for PyWb (Python Wayback) backend routes, providing:
 * 
 * 1. Backend abstraction: Hides the actual PyWb backend URL from frontend
 * 2. URL transformation: Strips '/wayback' prefix and redirects to PyWb backend
 * 3. Centralized routing: Single place for all backend redirect configuration
 * 4. Route flexibility: Handles routes with and without URL path parameters
 * 
 * Example:
 *   Request:  https://arquivo.pt/wayback/cdx?url=example.com
 *   Redirects: https://pywb-backend.pt/cdx?url=example.com
 * 
 * This pattern enables microservices architecture where the Node.js/Express
 * frontend communicates with separate PyWb backend services.
 */

const config = require('config');

module.exports = function (app) {
    
    const handledRoutes = [
        '/wayback/cdx',
        '/wayback/timemap'
    ]
    
    /**
     * Transforms frontend URL to backend PyWb URL
     * Removes the 'wayback' token and reconstructs URL with PyWb backend base URL
     */
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
