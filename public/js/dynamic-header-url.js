'use strict';

// dateFromTimestamp: functions.js.
/* global dateFromTimestamp */

(() => {
    const eventMethod = window.addEventListener ? "addEventListener" : "attachEvent";
    const messageEvent = eventMethod == "attachEvent" ? "onmessage" : "message";

    // The pages that load this script replay into #replay_iframe, whose src is on the
    // configured backend (patching.url or services.archivepagenow.url). Only messages
    // posted by that iframe's own window, on that origin, may update the header: not
    // frames nested in the replayed page nor windows it opens. The iframe is looked up
    // on each message because this script runs in <head>, before the body is parsed.
    const replayOrigin = (iframe) => {
        try {
            const src = new URL(iframe.src);
            return ['http:', 'https:'].includes(src.protocol) ? src.origin : null;
        } catch {
            return null;
        }
    };

    // Only http(s) URLs go into the header link.
    const isHttpUrl = (url) => {
        try {
            return typeof url === 'string' && ['http:', 'https:'].includes(new URL(url).protocol);
        } catch {
            return false;
        }
    };

    window[eventMethod](messageEvent, (e) => {
        const iframe = document.getElementById('replay_iframe');
        if (!iframe || !iframe.contentWindow || e.source !== iframe.contentWindow
            || e.origin !== replayOrigin(iframe)) {
            return;
        }
        const key = e.message ? "message" : "data";
        if (e[key] && e[key].wb_type && isHttpUrl(e[key].url)) {
            if ( ['load', 'replace-url', 'unload'].includes(e[key].wb_type) ) {
                const presentationUrl = e[key].url.replace(/^(http(s)?\:\/\/)?(www\.)?/,'').replace(/\/$/,'');
                const headerUrl = document.getElementById('headerUrl');
                if (headerUrl) {
                    headerUrl.textContent = presentationUrl;
                    headerUrl.setAttribute('href', e[key].url);
                    headerUrl.setAttribute('title', e[key].url);
                }

                const headerTimestamp = document.getElementById('headerTimestamp');
                if (e[key].ts && headerTimestamp) {
                    headerTimestamp.textContent = dateFromTimestamp(e[key].ts, 'long');
                }
            }
        }
    }, true);
})();
