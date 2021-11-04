$(() => {
    // Generate random string/characters
    // len is optional
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

    const updateSearchResults = function(){
        var client_id = getClientId(20);
        var search_id = generateId(20);
        var trackingId = client_id + '_' + search_id;

        const doUpdate = function(parent,target,type){
            $(parent).off("click",target).on("click",target,(e) => {
                e.preventDefault();
                const result = $(e.target).closest(target);
                const index = result.attr('data-index');
                const tstamp = result.attr('data-tstamp');
                const url = result.attr('data-url');

                const fullUrl = "/" + type.toLowerCase() + "/view/" + trackingId + "_" + index + '/' + tstamp + '/' + url;

                ga('send', 'event', 'Search result', type + ' search', 'Result position', index);
                window.location=fullUrl;
            });
            $(parent).off("keypress",target).on("keypress",target,(e) => {
                if(e.which == 32 || e.which == 13){
                    e.preventDefault();
                    $(e.target).click();
                }
            });
        }

        doUpdate('#pages-results','.page-search-result','Page');
        doUpdate('#modal','img.image-display','Image');
        doUpdate('#modal','#image-website-url-button','Image');
    }

    const eventMethod = window.addEventListener ? "addEventListener" : "attachEvent";
    const messageEvent = eventMethod == "attachEvent" ? "onmessage" : "message";

    window[eventMethod](messageEvent, (e) => {
        const key = e.message ? "message" : "data";
        if(e[key] && e[key].arquivo_type && e[key].message && e[key].arquivo_type == 'section-loaded' && e[key].message == 'search-results'){
            updateSearchResults();
        }
    });

    
});