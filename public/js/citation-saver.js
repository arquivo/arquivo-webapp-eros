$(() => {
    $(".citation-saver-input-selection form").submit(function (e) {

        e.preventDefault();

        var form = $(this);
        var actionUrl = form.attr('action');

        
        $('#modal #citation-saver-progress-bar').show();
        $('#modal #citation-saver-modal').hide();
        $('#modal').modal({escapeClose: false, clickClose: false, showClose: false });

        $.ajax({
            type: "POST",
            url: actionUrl,
            data: new FormData(this),
            processData: false,
            contentType: false,
            success: (data) => {
                if(data.status){
                    $('#modal p.text').show();
                    $('#modal p.error').hide();
                } else {
                    $('#modal p.text').hide();
                    $('#modal p.error').show();
                    if(typeof data.message == 'string'){
                        $('#modal p.error').text(data.message);
                    } else {
                        $('#modal p.error').text(JSON.stringify(data.message));
                    }
                }
                
            },
            error: (err) => {
                // alert('ERROR!! ' +JSON.stringify(err));
                $('#modal p.text').hide();
                $('#modal p.error').show();
                if(typeof err == 'string'){
                    $('#modal p.error').text(err);
                } else {
                    $('#modal p.error').text(JSON.stringify(err));
                }
            },
            complete: () => {
                $('#modal #citation-saver-progress-bar').hide();
                $('#modal #citation-saver-modal').show();
            }
        });

    });
});

function getFile() {
}
  
$(document).on("click", "#input-file-selector", function(e) {
    e.preventDefault();
    $("#input-file-file").click();
});
$(document).on("input", "input:file", function(e) {
    $("#input-file-text").text(e.target.files[0].name);
});