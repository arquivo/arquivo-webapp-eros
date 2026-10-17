// Common procedures to run on every page load
(function (init) {
    // Same timing as jQuery's $(fn): once the DOM is parsed, or now if it already is.
    // It listens on window, in the capture phase, so it runs before the DOMContentLoaded
    // listeners on document, jQuery's ready queue included. The later scripts' $(fn) and
    // DOMContentLoaded callbacks thus still find the #modal div created here
    // (datepicker.js and modal-image-result.js keep `$('#modal')`).
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', init, { capture: true, once: true });
    } else {
        init();
    }
})(() => {
    /*
     * jQuery's form.serialize(): the fields a submission of the form sends, URL-encoded with
     * spaces as '+'. FormData also has the files of file inputs, which serialize() leaves out.
     */
    function serializeForm(form) {
        const fields = form ? Array.from(new FormData(form)).filter(([, value]) => typeof value === 'string') : [];
        return new URLSearchParams(fields).toString();
    }

    /*
     * Replace element with the nodes of an HTML string, like jQuery's replaceWith(html):
     * the inline scripts in the HTML run once it is in the page, in order.
     * HTML parsed by innerHTML never runs its scripts, so each one is swapped for a new copy.
     */
    function replaceWithHtml(element, html) {
        const template = document.createElement('template');
        template.innerHTML = html;
        const scripts = template.content.querySelectorAll('script');
        element.replaceWith(template.content);
        scripts.forEach(parsed => {
            const script = document.createElement('script');
            Array.from(parsed.attributes, ({ name, value }) => script.setAttribute(name, value));
            script.text = parsed.text;
            parsed.replaceWith(script);
        });
    }

    //make sure we have a modal div
    if(!document.getElementById('modal')){
        document.body.insertAdjacentHTML('beforeend', '<div id="modal" onclick="closeReplayRightMenuNav()"></div>');
    }

    //disable links inside elements with "blockUrl" class
    document.querySelectorAll('a.blockUrl').forEach(link => link.addEventListener('click', (e) => e.preventDefault()));

    //load ajax content:
    const loadingSection = document.getElementById('loading-section');
    if(loadingSection){
        let afterReplace = () => {}
        const message = loadingSection.getAttribute('onloadmessage');
        if(message){
            afterReplace = () => {
                window.postMessage({
                    'arquivo_type': 'section-loaded',
                    message: message
                });
            };
        }
        const loadingForm = document.getElementById('loading-form');
        // Same request as $.ajax: a same-origin GET (so with the cookies), with jQuery's
        // X-Requested-With header. Like before, a failed request or an HTTP error status
        // leaves the section as it is.
        fetch(document.location.origin + loadingForm?.getAttribute('action') + '?' + serializeForm(loadingForm), {
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
        })
            .then(response => response.ok ? response.text() : Promise.reject(new Error('HTTP ' + response.status)))
            .then(html => {
                replaceWithHtml(loadingSection, html);
                afterReplace();
            }, () => {});
    }

    document.body.addEventListener('submit', (e) => {
        const form = e.target.closest('form');
        if(form && form.getAttribute('action')?.includes('search') && !form.querySelector('input[name=trackingId]')){
            const trackingIdInput = document.createElement('input');
            trackingIdInput.setAttribute('type', 'hidden');
            trackingIdInput.setAttribute('name', 'trackingId');
            trackingIdInput.value = getClientId() + '_' + generateId(); //searchId_userId
            form.append(trackingIdInput);
        }
    });
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