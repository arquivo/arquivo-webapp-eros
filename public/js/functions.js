//////////////////////////////////////////////////////////////////////////////////////////////////////////
// JavaScript functions for Arquivo.pt ///////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////

// starts: menu opening and closing button for top nav left menu button //////////////////////////////////
function openLeftMenuNav() {
  $("#left-nav").attr('style',"left:0px;"); 
  $(".blocker-menus").attr('style',"display:block;position: fixed; z-index:1"); 
}
function closeLeftMenuNav() {
  $("#left-nav").attr('style',"left:-200px");
  $(".blocker-menus").attr('style',"display:none;position: fixed; z-index:1"); 
}
// ends: menu opening and closing button for top nav left menu button ////////////////////////////////////

// starts: menu opening and closing button for top nav right menu button  ////////////////////////////////

function openOptionstMenuNav() {
  $("#options-right-nav").attr('style',"right:0px;"); 
  $(".blocker-menus").attr('style',"display:block;position: fixed; z-index:1"); 
}
function closeOptionsMenuNav() {
  $("#options-right-nav").attr('style',"right:-250px");
  $(".blocker-menus").attr('style',"display:none;position: fixed; z-index:1"); 
}
// ends: menu opening and closing button for top nav right menu button ///////////////////////////////////

//////////////////////////////////////////////////
// REPLAY ////////////////////////////////////////
//////////////////////////////////////////////////


// starts: menu opening and closing button for top nav left replay menu button //////////////////////////////////
function openReplayLeftMenuNav() {
  $("#replay-left-nav").attr('style',"left:0px;"); 
}
function closeReplayLeftMenuNav() {
  $("#replay-left-nav").attr('style',"left:-200px");
}
// ends: menu opening and closing button for top nav left replay menu button ////////////////////////////////////

// starts: menu opening and closing button for top nav right replay menu button /////////////////////////////////
function openReplayRightMenuNav() {
    $("#replay-right-nav").attr('style',"right:0px;"); 
    $(".blocker-menus").attr('style',"display:block;position: fixed; z-index:2 ")
}
function closeReplayRightMenuNav() {
    $("#replay-right-nav").attr('style',"right:-250px");  
    $(".blocker-menus").attr('style',"display:none;position: fixed; z-index:1");
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
  $("#alert-container").attr('style',"top:0;height:47px;opacity:1;transition:0.3s"); 
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
}

// closes image technical details window that stays on top of modal image
function closeImageDetailsModalWindowButton() {
  $('#close-modal-tecnhical').attr('style',"display:none; transition:0.5s");   
}

