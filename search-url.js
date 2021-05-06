// https://arquivo.pt/wayback/cdx?output=json&url=http%3A%2F%2Farquivo.pt&fields=url%2Ctimestamp%2Cstatus&filter=!~status%3A4%7C5&from=19960101&to=20210420
// https://arquivo.pt/wayback/cdx?output=json&url=http%3A%2F%2Farquivo.pt&fields=url,timestamp,status&filter=!~status%3A4%7C5&from=19960101&to=20210420
const config = require('config');
const sanitizeInputs = require('./sanitize-search-params');
const apiRequest = require('./cdx-api')


const now = new Date();

module.exports = function (req, res) {
    const requestData = sanitizeInputs(req, res);
    const defaultApiParams = {
        output: 'json',
        from: '19910806',
        url: requestData.get('q'),
        to: now.toLocaleDateString('en-CA').split('-').join(''),
        filter: '!~status:4|5',
        fields: 'url,timestamp,status'
    }
    const apiRequestData = new URLSearchParams();

    //Load parameters onto api request data
    Object.keys(defaultApiParams)
        .filter(key => defaultApiParams[key] !== null || requestData.has(key))
        .forEach(key => apiRequestData.set(key, requestData.get(key) ?? defaultApiParams[key]));

    apiRequest(apiRequestData,
        (apiData) => {
            // res.render('partials/pages-search-results', {
            //     requestData: requestData,
            //     apiData: apiData,
            //     suggestion: suggestion,
            // });
            // console.log(apiData);
            res.send('<p>Temporary</p>')
        });
}
