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
      console.log(imageData);

      setModalAttr('form#view-image-website','pageLinkToArchive','action',imageData)

      setModalAttr('img.image-display','imgLinkToArchive','src',imageData)
      setModalAttr('img.image-display','imgTitle','title',imageData)
      
      setModalText('.image-alt','imgAlt',imageData);
      setModalText('.image-title','imgTitle',imageData);
      setModalText('.image-description-url a','imgSrc',imageData);
      setModalAttr('.image-description-url a','imgSrc','href',imageData);
      setModalText('.image-description-date .date','imgTstamp',imageData, (ts) => dateFromTimestamp(ts));
      setModalText('.image-description-date .timestamp','pageTstamp',imageData);
      
      setModalText('.page-title','pageTitle',imageData);
      setModalText('.page-description-url a','pageURL',imageData);
      setModalAttr('.page-description-url a','pageURL','href',imageData);
      setModalText('.page-description-date .date','pageTstamp',imageData, (ts) => dateFromTimestamp(ts));
      setModalText('.page-description-date .timestamp','pageTstamp',imageData);
      
      setModalText('.image-description-resolution .width','imgWidth',imageData);
      setModalText('.image-description-resolution .height','imgHeight',imageData);
      
      setModalText('.image-description-mimetype .mimetype','imgMimeType',imageData,(t) => t.split('/').pop());
      setModalText('.image-description-safesearch .safesearch','safe',imageData);

      setModalText('.collection-description-name .name','collection',imageData);
      modal.find('p.raw-api-data').text(JSON.stringify(imageData,null, '\t'));
      modal.find('#copy-raw-api-data').click(function(){
        let text = modal.find('p.raw-api-data').text();
        console.log(text);
        let elem = document.createElement("textarea");
        document.body.appendChild(elem);
        elem.value = text;
        elem.select();
        document.execCommand("copy");
        document.body.removeChild(elem);
      })
      
    }

    let setModalText = function(selector, fieldName, imageData, transform = (v) => v){
      if( imageData[fieldName] === undefined || 
        (Array.isArray(imageData[fieldName]) && imageData[fieldName].length == 0) ||
        ('' + imageData[fieldName]).trim() == '' 
        ) {
          console.log('hiding selector: '+selector);
          console.log('because of missing param: '+fieldName);
          modal.find(selector).parents('div.modal-image-field').hide();
        } else if(Array.isArray(imageData[fieldName])) {
          modal.find(selector).text(transform(imageData[fieldName].join(' | '))).show()
        } else {
          modal.find(selector).text(transform(imageData[fieldName])).parents('div.modal-image-field').show();
        }
    }

    let setModalAttr = function(selector, fieldName, attribute, imageData){
      if( imageData[fieldName] !== undefined) {
          modal.find(selector).attr(attribute,imageData[fieldName]);
        }
    }
  
  }
});