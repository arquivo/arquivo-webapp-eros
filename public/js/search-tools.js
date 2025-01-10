// Logic regarding the main search bar. 

$(function(){
    // ContaMeHistorias monitoring
    $('#search-tools-narrative-button').click(() => {
        $('#search-form-narrative input[name=query]').val($('#submit-search-input').val());
        gtag("event", 'contameHistorias', {
            "type": 'Pressed', 
            "query": $('#submit-search-input').val() || '<empty>' 
        } );
        $('#confirm-narrative-modal').modal();
    });
    $('#search-form-narrative').submit(function (e) {
        if($('#search-form-narrative input[name=query]').val() == ''){
            $('#search-form-narrative input[name=query]').remove();
            $('#search-form-narrative').attr('action', contaMeHistoriasURL); // URL filled in javascript_and_css_links.ejs, it's contame.historias.url property
        }
        gtag("event", 'contameHistorias', {
            "type": 'Searched', 
            "query": $('#submit-search-input').val() || '<empty>' 
        } );
        return true;
    });

    // Logic to ensure that we make the correct request when user changes the query 
    //   before clicking on some search service 
    //   (i.e. pages, images and advanced search butons)
    $('form.search-type').submit(function (e) {
        $(e.target).find('input').remove();
        $('<input>').attr({
            type: 'hidden',
            name: 'q',
            value: $('#submit-search-input').val()
        }).appendTo(e.target);
        $('<input>').attr({
            type: 'hidden',
            name: 'from',
            value: $('#start-date').val()
        }).appendTo(e.target);
        $('<input>').attr({
            type: 'hidden',
            name: 'to',
            value: $('#end-date').val()
        }).appendTo(e.target);
        
        return true;
    });

    // Ensures the advanced search form knows about changes to the maxItems parameter
    $('form#search-form-advanced').submit(function (e) {
        const urlParams = new URLSearchParams(window.location.search);
        if(!!urlParams.get('maxItems')){
            $('<input>').attr({
                type: 'hidden',
                name: 'maxItems',
                value: urlParams.get('maxItems')
            }).appendTo(e.target);
        }
        return true;
    });
});