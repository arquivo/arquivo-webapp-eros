// Common procedures to run on every page load
$(function(){
    //make sure we have a modal div
    let modal = $('#modal');
    if(!modal.length){
        $('body').append('<div id="modal" onclick="closeReplayRightMenuNav()"></div>');
    }

    //disable links inside elements with "blockUrl" class
    $('a.blockUrl').click((e) => e.preventDefault());

    //load ajax content:
    const loadingSection = $('#loading-section');
    if(loadingSection.length){
        let afterReplace = () => {}
        if(!!loadingSection.attr('onloadmessage')){
            const message = loadingSection.attr('onloadmessage');
            afterReplace = () => {
                window.postMessage({
                    'arquivo_type': 'section-loaded',
                    message: message
                });
            };
        }
        const loadingForm = $('#loading-form');
        $.ajax({
            url: document.location.origin + loadingForm.attr('action')+'?'+loadingForm.serialize(),
            success: function (data) {
                loadingSection.replaceWith(data);
                afterReplace();
            }
        });
    }

    $('body').on('submit',(e) => {
        let form = $(e.target);
        let trackingIdInput = form.find('input[name=trackingId]');
        if(form.attr('action').includes('search') && !trackingIdInput.length){
            trackingIdInput = $('<input>')
            .attr('type','hidden')
            .attr('name','trackingId')
            .val(getClientId() + '_' + generateId()); //searchId_userId
            form.append(trackingIdInput);
        } 
        return true;
    })
});


const generateId = function (len=20) {
    function dec2hex(dec) {
        return ('0' + dec.toString(16)).substr(-2)
    }
    var arr = new Uint8Array((len || 40) / 2)
    window.crypto.getRandomValues(arr)
    return Array.from(arr, dec2hex).join('')
}

/*
 * Get the client identification. If it didn't have any, generate a new one
 * and save it to a cookie.
 */
const getClientId = function () {
    function setCookie(cname, cvalue, exdays) {
        var d = new Date();
        d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
        var expires = "expires=" + d.toUTCString();
        document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
    }
    function getCookie(cname) {
        var name = cname + "=";
        var ca = document.cookie.split(';');
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) == ' ') {
                c = c.substring(1);
            }
            if (c.indexOf(name) == 0) {
                return c.substring(name.length, c.length);
            }
        }
        return "";
    }
    const clientIdCookieName = "client_id";
    let client_id = getCookie(clientIdCookieName);
    if (client_id.length == 0) {
        client_id = generateId(20);
        setCookie(clientIdCookieName, client_id, 1);
    }
    return client_id;
}