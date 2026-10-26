'use strict';

$(() => {
    var $consentFields = $('.citation-saver-input-selection .input-tab input, .citation-saver-input-selection .input-tab textarea, .citation-saver-input-selection .input-tab button');

    function updateConsentGate() {
        var granted = document.getElementById('consent-protection').checked
            && document.getElementById('consent-processing').checked;
        $consentFields.prop('disabled', !granted);
    }

    updateConsentGate();
    $('#consent-protection, #consent-processing').on('change', updateConsentGate);

    $(".citation-saver-input-selection form").submit(function (e) {

        e.preventDefault();

        var consentProtection = document.getElementById('consent-protection');
        var consentProcessing = document.getElementById('consent-processing');

        if (!consentProtection.checkValidity()) {
            consentProtection.reportValidity();
            return;
        }
        if (!consentProcessing.checkValidity()) {
            consentProcessing.reportValidity();
            return;
        }

        var form = $(this);
        var actionUrl = form.attr('action');


        $('#modal #citation-saver-progress-bar').show();
        $('#modal #citation-saver-modal').hide();
        $('#modal').modal({escapeClose: false, clickClose: false, showClose: false });

        const showError = (text) => {
            $('#modal p.text').hide();
            $('#modal p.error').show();
            $('#modal p.error').text(text);
        };
        const success = (data) => {
            if(data.status){
                $('#modal p.text').show();
                $('#modal p.error').hide();
            } else if(typeof data.message == 'string'){
                showError(data.message);
            } else {
                showError(JSON.stringify(data.message));
            }
        };
        const error = (status, statusText) => {
            showError(JSON.stringify({ status: status, statusText: statusText }));
        };
        // An HTTP error such as 413 (file too large) or 429 (too many submissions) can
        // come with the server's { status, message } JSON: show its message if it has one.
        const httpError = (response) => response.json().then((data) => {
            if (data && typeof data.message == 'string') {
                showError(data.message);
            } else {
                error(response.status, response.statusText);
            }
        }, () => error(response.status, response.statusText));

        const body = new FormData(this);
        // A text goes as a file part, which the server streams to disk under the upload
        // limit like a file, instead of a form field that it keeps in memory. An empty
        // text is left out, so the server replies that no document was submitted.
        const text = body.get('text');
        if (text === '') {
            body.delete('text');
        } else if (typeof text == 'string') {
            body.set('text', new Blob([text], { type: 'text/plain' }), 'text.txt');
        }

        fetch(actionUrl, {
            method: 'POST',
            // Sent as is, so the browser sets the multipart content type and its boundary.
            body: body,
            credentials: 'same-origin'
        })
            .then((response) => {
                // As with $.ajax, an HTTP error status or a reply that is not JSON is an error.
                if (!response.ok) {
                    return httpError(response);
                }
                return response.json().then(success, () => error(response.status, 'parsererror'));
            }, () => error(0, 'error'))
            .finally(() => {
                $('#modal #citation-saver-progress-bar').hide();
                $('#modal #citation-saver-modal').show();
            });

    });
});

$(document).on("click", "#input-file-selector", function(e) {
    e.preventDefault();
    $("#input-file-file").click();
});
$(document).on("input", "input:file", function(e) {
    $("#input-file-text").text(e.target.files[0].name);
});