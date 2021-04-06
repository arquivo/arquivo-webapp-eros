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
        const loadingForm = $('#loading-form');
        $.ajax({
            url: document.location.origin + loadingForm.attr('action')+'?'+loadingForm.serialize(),
            success: function (data) {
                loadingSection.replaceWith(data);
            }
        });
    }
    const closeAllMenus = function(){
        closeLeftMenuNav();
        closeOptionsMenuNav();
        closeReplayLeftMenuNav();
        closeReplayRightMenuNav();
    }
    $('body').children().not('header').on('click',() => closeAllMenus());
    $('body').on('click',(e) => { if($(e.target).is('body')){closeAllMenus();}});
});
