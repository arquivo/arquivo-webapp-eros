$(() => {
    $(".citation-saver-input-selection form").submit(function (e) {

        e.preventDefault();

        var form = $(this);
        var actionUrl = form.attr('action');

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
                
                $('#modal').modal({escapeClose: false, clickClose: false, showClose: false });
                
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
                $('#modal').modal({escapeClose: false, clickClose: false, showClose: false });
            }
        });

    });
});