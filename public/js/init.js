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
        
        console.log(loadingForm.html());
        console.log(loadingForm.serialize());
        $.ajax({
            url: '/'+loadingForm.attr('action')+'?'+loadingForm.serialize(),
            success: function (data) {
                loadingSection.replaceWith(data);
            }
        });
    }
});
