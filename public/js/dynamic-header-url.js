(() => {
    const eventMethod = window.addEventListener ? "addEventListener" : "attachEvent";
    const messageEvent = eventMethod == "attachEvent" ? "onmessage" : "message";

    window[eventMethod](messageEvent, (e) => {
        const key = e.message ? "message" : "data";
        if (e[key] && e[key].wb_type && e[key].url) {
            console.log(e[key]);
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