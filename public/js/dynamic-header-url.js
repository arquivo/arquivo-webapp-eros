(() => {
    const eventMethod = window.addEventListener ? "addEventListener" : "attachEvent";
    const messageEvent = eventMethod == "attachEvent" ? "onmessage" : "message";

    window[eventMethod](messageEvent, (e) => {
        const key = e.message ? "message" : "data";
        if (e[key] && e[key].wb_type && e[key].url) {
            console.log(e[key]);
            if ( ['load', 'replace-url', 'unload'].includes(e[key].wb_type) ) {
                const presentationUrl = e[key].url.replace(/^(http(s)?\:\/\/)?(www\.)?/,'').replace(/\/$/,'');
                $("#headerUrl").text(presentationUrl);
                $("#headerUrl").attr('href',e[key].url);
                $("#headerUrl").attr('title',e[key].url);

                if(e[key].ts && $("#headerTimestamp").length){
                    $("#headerTimestamp").text( dateFromTimestamp(e[key].ts,format='long') );
                }
            }
        }
    }, true);
})();