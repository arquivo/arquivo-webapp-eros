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
      let imageData = JSON.parse($(this).find('.image-data').first().text());

      modal.html(modalImageDetails);
      setupModalImageDetails(imageData);
      setupSlideOnClick($(this).prev(),'previous');
      setupSlideOnClick($(this).next(),'next');
      modal.modal();
    });

    let setupSlideOnClick = function(newSlide, direction){
      let buttonId,slideOutDirection,slideInDirection;
      
      if(direction == 'previous'){
        buttonId = '#previous-image-button';
        slideOutDirection = "right";
        slideInDirection = "left";
      } else if (direction == 'next'){
        buttonId = '#next-image-button';
        slideOutDirection = "left";
        slideInDirection = "right";
      } else {
        return;
      }
      if (newSlide.length) {
        modal.find(buttonId).show().click(function () {

          let oldContainer = modal.find('section.modal-image-details-container');
          let newContainer = $(modalImageDetails).hide();
          let newImageData = JSON.parse($(newSlide[0]).find('.image-data').first().text())
          setupModalImageDetails(newImageData,newContainer);
          modal.append(newContainer);
          
          oldContainer.hide("slide", { direction: slideOutDirection }, 250, function () {
            newContainer.show("slide", { direction: slideInDirection }, 250, function () {
                  oldContainer.remove();
                  setupSlideOnClick(newSlide.prev(),'previous');
                  setupSlideOnClick(newSlide.next(),'next');
                });
          });
        });
      } else {
        modal.find(buttonId).hide();
      }

    }


    let setupModalImageDetails = function (imageData, target = modal) {

      setModalAttr('form#view-image-website', 'pageLinkToArchive', 'action', imageData, target)

      setModalAttr('img.image-display', 'imgLinkToArchive', 'src', imageData, target)
      setModalAttr('img.image-display', 'imgTitle', 'title', imageData, target)

      setModalText('.image-alt', 'imgAlt', imageData, target);
      setModalText('.image-title', 'imgTitle', imageData, target);
      setModalText('.image-description-url a', 'imgSrc', imageData, target);
      setModalAttr('.image-description-url a', 'imgSrc', 'href', imageData, target);
      setModalText('.image-description-date .date', 'imgTstamp', imageData, target, (ts) => dateFromTimestamp(ts));
      setModalText('.image-description-date .timestamp', 'pageTstamp', imageData, target);

      setModalText('.page-title', 'pageTitle', imageData, target);
      setModalText('.page-description-url a', 'pageURL', imageData, target);
      setModalAttr('.page-description-url a', 'pageURL', 'href', imageData, target);
      setModalText('.page-description-date .date', 'pageTstamp', imageData, target, (ts) => dateFromTimestamp(ts));
      setModalText('.page-description-date .timestamp', 'pageTstamp', imageData, target);

      setModalText('.image-description-resolution .width', 'imgWidth', imageData, target);
      setModalText('.image-description-resolution .height', 'imgHeight', imageData, target);

      setModalText('.image-description-mimetype .mimetype', 'imgMimeType', imageData, target, (t) => t.split('/').pop());
      setModalText('.image-description-safesearch .safesearch', 'safe', imageData, target);

      setModalText('.collection-description-name .name', 'collection', imageData, target);
      target.find('p.raw-api-data').text(JSON.stringify(imageData, null, '\t'));
      target.find('#copy-raw-api-data').click(function () {
        let text = target.find('p.raw-api-data').text();
        let elem = document.createElement("textarea");
        document.body.appendChild(elem);
        elem.value = text;
        elem.select();
        document.execCommand("copy");
        document.body.removeChild(elem);
      })

    }

    let setModalText = function (selector, fieldName, imageData, target, transform = (v) => v) {
      if (imageData[fieldName] === undefined ||
        (Array.isArray(imageData[fieldName]) && imageData[fieldName].length == 0) ||
        ('' + imageData[fieldName]).trim() == ''
      ) {
        target.find(selector).parents('div.modal-image-field').hide();
      } else if (Array.isArray(imageData[fieldName])) {
        target.find(selector).text(transform(imageData[fieldName][0])).parents('div.modal-image-field').show()
      } else {
        target.find(selector).text(transform(imageData[fieldName])).parents('div.modal-image-field').show();
      }
    }

    let setModalAttr = function (selector, fieldName, attribute, imageData, target) {
      if (imageData[fieldName] !== undefined) {
        target.find(selector).attr(attribute, imageData[fieldName]);
      }
    }

  }
});