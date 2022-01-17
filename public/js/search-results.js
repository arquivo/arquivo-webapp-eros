$(() => {
    const updateSearchResults = function(){
        var client_id = getClientId();
        var search_id = generateId(20);
        var trackingId = client_id + '_' + search_id;

        const doUpdate = function(parent,target,type,redirect=true){
            function redirectToWayback(result, newTab=false){
                const index = result.attr('data-index');
                const tstamp = result.attr('data-tstamp');
                const url = result.attr('data-url');

                ga('send', 'event', 'Search result', type + ' search', 'Result position', index);
                const form = $('#search-result-form-'+index);
                if(form.length){
                    if(newTab){
                        form.attr("target","_blank");
                    } else {
                        form.attr("target","");
                    }
                    if(redirect){
                        form.submit();
                    } else {
                        $.ajax(form.attr('action'));
                    }
                } else {
                    const fullUrl = "/" + type.toLowerCase() + "/view/" + trackingId + "_" + index + '/' + tstamp + '/' + url;
                    if(redirect){
                        if(newTab){
                            window.open(fullUrl,'_blank');
                        } else {
                            window.location = fullUrl;
                        }
                    } else {
                        $.ajax(fullUrl);
                    }
                }
            }


            $(parent).off("mousedown",target).on("mousedown",target,(e) => {
                const varholder = $(e.target).closest(parent);
                const result = $(e.target).closest(target);
                varholder[0].mymousedata = {
                    target: result[0],
                    which: e.which,
                } 
            })
            $(parent).off("mouseup",target).on("mouseup",target,(e) => {
                const varholder = $(e.target).closest(parent);
                const result = $(e.target).closest(target);
                const mousedata = varholder[0].mymousedata;
                if(!!mousedata && mousedata.which == e.which && mousedata.target == result[0] && e.which < 3 ){
                    if($(e.target).is('button') && $(e.target).attr('type') == 'submit' ){
                        return true;
                    }
                    e.preventDefault();
                    redirectToWayback(result,e.which==2);
                }

            });
            $(parent).off("keypress",target).on("keypress",target,(e) => {
                if(e.which == 32 || e.which == 13){
                    if($(e.target).is('button') && $(e.target).attr('type') == 'submit' ){
                        return true;
                    }
                    e.preventDefault();
                    redirectToWayback($(e.target).closest(target));
                }
            });
        }

        doUpdate('#pages-results','.page-search-result','Page');
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