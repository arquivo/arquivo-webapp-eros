//////////////////////////////////////////////////////////////////////////////////////////////////////////
// JavaScript functions for Arquivo.pt ///////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////

// starts: menu opening and closing button for top nav left menu button //////////////////////////////////
function openLeftMenuNav() {
  $("#left-nav").attr('style',"left:0px;"); 
  $(".blocker-menus").attr('style',"display:block;position: fixed; z-index:1;transition:0.5s"); 
}
function closeLeftMenuNav() {
  $("#left-nav").attr('style',"left:-200px");
  $(".blocker-menus").attr('style',"display:none;position: fixed; z-index:1;transition:0.5s"); 
}
// ends: menu opening and closing button for top nav left menu button ////////////////////////////////////

// starts: menu opening and closing button for top nav right menu button  ////////////////////////////////

function openOptionstMenuNav() {
  $("#options-right-nav").attr('style',"right:0px;"); 
  $(".blocker-menus").attr('style',"display:block;position: fixed; z-index:1;transition:0.5s"); 
}
function closeOptionsMenuNav() {
  $("#options-right-nav").attr('style',"right:-250px");
  $(".blocker-menus").attr('style',"display:none;position: fixed; z-index:1;transition:0.5s"); 
}
// ends: menu opening and closing button for top nav right menu button ///////////////////////////////////

//////////////////////////////////////////////////
// REPLAY ////////////////////////////////////////
//////////////////////////////////////////////////


// starts: menu opening and closing button for top nav left replay menu button //////////////////////////////////
function openReplayLeftMenuNav() {
  $("#replay-left-nav").attr('style',"left:0px;transition:0.5s"); 
}
function closeReplayLeftMenuNav() {
  $("#replay-left-nav").attr('style',"left:-200px;transition:0.5s");
}
// ends: menu opening and closing button for top nav left replay menu button ////////////////////////////////////

// starts: menu opening and closing button for top nav right replay menu button /////////////////////////////////
function openReplayRightMenuNav() {
    $("#replay-right-nav").attr('style',"right:0px;"); 
    $(".blocker-menus").attr('style',"display:block;position: fixed; z-index:2;transition:0.5s ")
}
function closeReplayRightMenuNav() {
    $("#replay-right-nav").attr('style',"right:-250px");     
    $(".blocker-menus").attr('style',"display:none;position: fixed; z-index:1;transition:0.5s");
}
// ends: menu opening and closing button for replay top nav right replay menu button 

// starts: copy URL to clipboard on click 
function copyURLToClipboard() {
  var urlCopier = document.createElement('input');
  var text = window.location.href;

  document.body.appendChild(urlCopier);
  urlCopier.value = text;
  urlCopier.select();
  document.execCommand('copy');
  document.body.removeChild(urlCopier);

  alertsMessageIn();
}
// ends: copy URL to clipboard on click 

// starts: alerts messages  

// alert message in
function alertsMessageIn() {
  $("#alert-container").attr('style',"top:0;height:49px;opacity:1;transition:0.3s;z-index:3"); 
  setTimeout(alertsMessageOut, 2000); 
}
// alert message out
function alertsMessageOut() {
  $("#alert-container").attr('style',"height:0px;opacity:0;transition:0.5s");     
}
// ends: alerts message  /////////////////////////////////////////////////////////////////////////////////

// starts: accordion function ////////////////////////////////////////////////////////////////////////////

// opens accordion
function openAdvancedSearchForm(){
 document.getElementById('accordion').style.display = "block";
 document.getElementById('closeAdvancedSearch').style.display = "block";
return false;
}
// closes accordion
function closeAdvancedSearch(){
 document.getElementById('accordion').style.display = "none";
return false;
}
// ends: accordion function /////////////////////////////////////////////////////////////////////////////

// opens replay page on fullscreen
function opensFullScreen() { 
  $('#replay-in-iframe').attr('style',"padding: 0;margin:0;width: 100%;position: absolute;z-index: 1;top:0;left:0;height: 100%;0.5s");  
  $('#fullscreen-mode').attr('style',"display: inline-block; position: absolute; z-index: 2; top: 0; right: 12px; height: 50px; width: 162px; background-color: transparent; box-shadow: none !important; 0.5s");  
}

// closes replay page on fullscreen
function closesFullScreen() {
  $('#replay-in-iframe').attr('style',"padding: 0; margin: 101px 0 0 0; max-width: 100%;  width: inherit; 0.5s");  
  $('#fullscreen-mode').attr('style',"display: none; transition: 0.5s");  
}

// shows replay table menu results and hide list menu results
function showTable() {
  var showTable = urlParam('table-results');
  if(showTable == "show-table") {
  $('#replay-menu-table').attr('style',"display: block");  
  $('#replay-menu-list').attr('style',"display: none");  
 }
}

// shows replay list menu results and hide table menu results
function showList() {
  var showTable = urlParam('table-results');
  if(showTable == "show-list") {
  $('#replay-menu-list').attr('style',"display: block");  
  $('#replay-menu-table').attr('style',"display: none");  
 }
}

// removes shadow from search input: homepage, page and image pages
function removeSearchBoxShadow() {
  $('#submit-search-input').attr('style',"-webkit-box-shadow: 0px 0px 0px 0px rgba(255 255 0 / 0%);box-shadow: 0px 0px 0px 0px rgba(255 255 0 / 0%);");
}

// shows shadow from search input: homepage, page and image pages
function showsSearchBoxShadow() {
  $('#submit-search-input').attr('style',"-webkit-box-shadow: 0px 4px 5px -2px rgba(0 0 0 / 25%);box-shadow: 0px 4px 5px -2px rgba(0 0 0 / 25%);");
}

// shows image technical details window that stays on top of modal image
function openImageDetailsModalWindow() {
  $('#modal-window-image-technical-details').attr('style',"display: block;transition:0.5s");
  $('#close-modal-tecnhical').attr('style',"display:block; transition:0.5s");  
}

// closes image technical details window that stays on top of modal image
function closeImageDetailsModalWindow() {
  $('#modal-window-image-technical-details').attr('style',"display:none; transition:0.5s");   
  $('#close-modal-tecnhical').attr('style',"display:none; transition:0.5s");   
}


function dateFromTimestamp(timestamp,format='long'){
  const availableFormats = ['long','medium','short'];

  if(!availableFormats.includes(format)){
    format = 'long';
  }
  
  const year = timestamp.slice(0,4)
  const month = timestamp.slice(4,6)
  const day = timestamp.slice(6,8)
  const hours = timestamp.slice(8,10)
  const minutes = timestamp.slice(10,12)

  if(format == 'long' && minutes.length < 2 ){
    format = 'medium'
  }

  let shortMonth = function(month){
    return $.datepicker.regional[lang].monthNamesShort[parseInt(month)-1];
  }
  let longMonth = function(month){
    return $.datepicker.regional[lang].monthNames[parseInt(month)-1];
  }
  switch (format){
    case 'long':
        return `${parseInt(day)} ${longMonth(month)} ${hours}h${minutes}, ${year}`;
    case 'medium':
      return `${parseInt(day)} ${longMonth(month)} ${year}`; 
    case 'short':
      return `${parseInt(day)} ${shortMonth(month)}`
    default:
      return 'ERROR';

  }
}

function isMobile () {
  return( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) || (window.matchMedia("(max-width: 767px)").matches);
}

