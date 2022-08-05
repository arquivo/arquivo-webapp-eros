(() => {
    const eventMethod = window.addEventListener ? "addEventListener" : "attachEvent";
    const messageEvent = eventMethod == "attachEvent" ? "onmessage" : "message";
    
    window[eventMethod](messageEvent, (e) => {
        const key = e.message ? "message" : "data";
        if (e[key] && e[key].wb_type) {
            if ( ['load', 'replace-url', 'unload'].includes(e[key].wb_type) ) {
                if(e[key].url){
                    $("#headerUrl").text(e[key].url);
                    $("#headerUrl").attr('href',e[key].url);
                    $("#headerUrl").attr('title',e[key].url);
                }
            }
        }
    }, true);
})();