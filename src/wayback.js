
const fetch = require('node-fetch');

module.exports = function (req, res) {

    function renderOk () {
        res.render('pages/replay',{requestedPage: {
            url: req.params.url + (req.params['0'] ?? ''),
        }});
    }
    function redirect(newUrl){
        res.redirect('/wayback'+newUrl.split('replay').filter((a,i) => i>0).join('replay'));
    }
    function renderError(){
        res.status(404).render('pages/arquivo-404');
    }
    const noFrameUrl = 'https://arquivo.pt/noFrame/replay/' + req.params.url + (req.params['0'] ?? '')
    fetch(noFrameUrl)
        .then(res => {
            if(res.url.replace(/^\/+|\/+$/g, '') != noFrameUrl.replace(/^\/+|\/+$/g, '')){
                redirect(res.url);
            } else if (res.ok) {
                renderOk();
            } else {
                renderError();
            }                    
        })
}
