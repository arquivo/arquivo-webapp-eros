$(function () {
  if ($('#images-results').length) {


    let modalImageDetails = '';
    $.ajax({
      url: '/partials/modal-image-details?l=' + lang,
      success: function (data) {
        modalImageDetails = data
      }
    });


    const modal = $('#modal');

    $("#images-results").on("click", "li.image-card", function () {
      let imageData = JSON.parse($(this).find('.image-data').first().text())
      modal.html(modalImageDetails);
      setupModalImageDetails(imageData);
      modal.modal();
    });

    let setupModalImageDetails = function(imageData){
      modal.find('img.image-display').attr('src',imageData.imgLinkToArchive);
      modal.find('.image-alt').text(imageData.imgAlt.join(' | '));
      modal.find('.image-description-url').text(imageData.imgURL);
      modal.find('a.image-description-url').attr('href',imageData.imgURL);

    }

  
  }
});