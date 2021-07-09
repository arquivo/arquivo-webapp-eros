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
      setupSlideOnClick($(this).prev(), 'previous');
      setupSlideOnClick($(this).next(), 'next');
      if (isMobile()) {
        setupDraggableInterface();
      }
      modal.modal();
    });

    let setupModalImageDetails = function (imageData, target = modal) {

      let setModalText = function (selector, fieldName, transform = (v) => v) {
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

      let setModalAttr = function (selector, fieldName, attribute) {
        if (imageData[fieldName] !== undefined) {
          target.find(selector).attr(attribute, imageData[fieldName]);
        }
      }

      setModalAttr('form#view-image-website', 'pageLinkToArchive', 'action')

      setModalAttr('img.image-display', 'imgLinkToArchive', 'src')
      setModalAttr('img.image-display', 'imgTitle', 'title')

      setModalText('.image-alt', 'imgAlt');
      setModalText('.image-title', 'imgTitle');
      setModalText('.image-description-url a', 'imgSrc');
      setModalAttr('.image-description-url a', 'imgSrc', 'href');
      setModalText('.image-description-date .date', 'imgTstamp', (ts) => dateFromTimestamp(ts));
      setModalText('.image-description-date .timestamp', 'pageTstamp');

      setModalText('.page-title', 'pageTitle');
      setModalText('.page-description-url a', 'pageURL');
      setModalAttr('.page-description-url a', 'pageURL', 'href');
      setModalText('.page-description-date .date', 'pageTstamp', (ts) => dateFromTimestamp(ts));
      setModalText('.page-description-date .timestamp', 'pageTstamp');

      setModalText('.image-description-resolution .width', 'imgWidth');
      setModalText('.image-description-resolution .height', 'imgHeight');

      setModalText('.image-description-mimetype .mimetype', 'imgMimeType', (t) => t.split('/').pop());
      setModalText('.image-description-safesearch .safesearch', 'safe');

      setModalText('.collection-description-name .name', 'collection');
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

    let setupSlideOnClick = function (newSlide, direction) {
      let buttonId, slideOutDirection, slideInDirection, mobileSlideOut, mobileSlideIn;

      if (direction == 'previous') {
        buttonId = '#previous-image-button';
        slideOutDirection = "right";
        slideInDirection = "left";
        mobileSlideOut = '100vh';
        mobileSlideIn = '-100vh';
      } else if (direction == 'next') {
        buttonId = '#next-image-button';
        slideOutDirection = "left";
        slideInDirection = "right";
        mobileSlideOut = '-100vh';
        mobileSlideIn = '100vh';
      } else {
        return;
      }
      if (newSlide.length) {
        modal.find(buttonId).show().click(function () {

          let oldContainer = modal.find('section.modal-image-details-container');
          let newContainer = $(modalImageDetails).hide();
          let newImageData = JSON.parse($(newSlide[0]).find('.image-data').first().text())
          setupModalImageDetails(newImageData, newContainer);
          modal.append(newContainer);
          if (isMobile()) {
            modal.animate({ left: mobileSlideOut }, 250, 'swing', function () {
              modal.css({ left: mobileSlideIn });
              oldContainer.remove();
              newContainer.show();
              setupSlideOnClick(newSlide.prev(), 'previous');
              setupSlideOnClick(newSlide.next(), 'next');
              modal.animate({ left: 0 }, 250)
            });
          } else {
            oldContainer.hide("slide", { direction: slideOutDirection }, 250, function () {
              newContainer.show("slide", { direction: slideInDirection }, 250, function () {
                oldContainer.remove();
                setupSlideOnClick(newSlide.prev(), 'previous');
                setupSlideOnClick(newSlide.next(), 'next');
              });
            });
          }
        });
      } else {
        modal.find(buttonId).hide();
        if (isMobile()) {
          modal.find(buttonId).click(function () {
            modal.animate({ left: 0 }, 250);
          });
        }
      }

    }

    let setupDraggableInterface = function () {
      const threshold = 100;
      const target = modal;
      target.draggable({
        axis: "x",
        revert: true,
        revertDuration: 250,
        drag: function (event, ui) {
          if (target.draggable("option", "revert")) {
            if (Math.abs(ui.position.left) > threshold) {
              target.draggable("option", "revert", false)
            }
          } else {
            if (Math.abs(ui.position.left) < threshold) {
              target.draggable("option", "revert", true)
            }
          }

        },
        stop: function (event, ui) {
          if (ui.position.left > threshold) {
            target.find('#previous-image-button').click();
          }
          if (ui.position.left < -threshold) {
            target.find('#next-image-button').click();
          }
        }
      });
      modal.find('#image-details-button').click(function () {
        modal.draggable("disable");
      })
      modal.find('#close-modal-tecnhical').click(function () {
        modal.draggable("enable");
      })
      modal.on($.modal.OPEN, function () {
        $(this).off($.modal.OPEN);
        setTimeout(function () {
          modal.on($.modal.CLOSE, function () {
            modal.draggable("destroy");
            $(this).off($.modal.CLOSE);
          })
        }, 100);
      })

    }



  }
});