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
                alert(JSON.stringify(data));
            },
            error: (err) => {
                alert('ERROR!! ' +JSON.stringify(err));
            }
        });

    });
});