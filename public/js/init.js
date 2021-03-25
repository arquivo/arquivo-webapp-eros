$(function(){
    let modal = $('#modal');
    if(!modal.length){
        $('body').append('<div id="modal"></div>');
    }

    //disable links inside elements with "blockUrl" class
    $('.blockUrl a').click((e) => e.preventDefault());
});
