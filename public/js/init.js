// Common procedures to run on every page load
$(function(){
    //make sure we have a modal div
    let modal = $('#modal');
    if(!modal.length){
        $('body').append('<div id="modal"></div>');
    }

    //disable links inside elements with "blockUrl" class
    $('.blockUrl a').click((e) => e.preventDefault());

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
});
