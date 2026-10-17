//////////////////////////////////////////////////////////////////////////////////////////////////////////
// JavaScript functions for Arquivo.pt ///////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////

// Replace the inline style of the element with this id, like jQuery's $('#id').attr('style', css).
// Does nothing when there is no such element, as jQuery did.
function setInlineStyle(id, css) {
  const element = document.getElementById(id);
  if (element) {
    element.style.cssText = css;
  }
}

// Replace the inline style of every element that matches the selector, like jQuery's
// $(selector).attr('style', css).
function setInlineStyleAll(selector, css) {
  document.querySelectorAll(selector).forEach((element) => {
    element.style.cssText = css;
  });
}

// starts: menu opening and closing button for top nav left menu button //////////////////////////////////
function openLeftMenuNav() {
  setInlineStyle('left-nav', "left:0px;"); 
  setInlineStyleAll('.blocker-menus', "display:block;position: fixed; z-index:1;transition:0.5s"); 
}
function closeLeftMenuNav() {
  setInlineStyle('left-nav', "left:-200px");
  setInlineStyleAll('.blocker-menus', "display:none;position: fixed; z-index:1;transition:0.5s"); 
}
// ends: menu opening and closing button for top nav left menu button ////////////////////////////////////

// starts: menu opening and closing button for top nav right menu button  ////////////////////////////////

function openOptionstMenuNav() {
  setInlineStyle('options-right-nav', "right:0px;"); 
  setInlineStyleAll('.blocker-menus', "display:block;position: fixed; z-index:1;transition:0.5s"); 
}
function closeOptionsMenuNav() {
  setInlineStyle('options-right-nav', "right:-250px");
  setInlineStyleAll('.blocker-menus', "display:none;position: fixed; z-index:1;transition:0.5s"); 
}
// ends: menu opening and closing button for top nav right menu button ///////////////////////////////////

//////////////////////////////////////////////////
// REPLAY ////////////////////////////////////////
//////////////////////////////////////////////////


// starts: menu opening and closing button for top nav left replay menu button //////////////////////////////////
function openReplayLeftMenuNav() {
  setInlineStyle('replay-left-nav', "left:0px;transition:0.5s"); 
}
function closeReplayLeftMenuNav() {
  setInlineStyle('replay-left-nav', "left:-200px;transition:0.5s");
}
// ends: menu opening and closing button for top nav left replay menu button ////////////////////////////////////

// starts: menu opening and closing button for top nav right replay menu button /////////////////////////////////
function openReplayRightMenuNav() {
    setInlineStyle('replay-right-nav', "right:0px;"); 
    setInlineStyleAll('.blocker-menus', "display:block;position: fixed; z-index:2;transition:0.5s ")
}
function closeReplayRightMenuNav() {
    setInlineStyle('replay-right-nav', "right:-250px");     
    setInlineStyleAll('.blocker-menus', "display:none;position: fixed; z-index:1;transition:0.5s");
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
  setInlineStyle('alert-container', "top:0;height:49px;opacity:1;transition:0.3s;z-index:3"); 
  setTimeout(alertsMessageOut, 2000); 
}
// alert message out
function alertsMessageOut() {
  setInlineStyle('alert-container', "height:0px;opacity:0;transition:0.5s");     
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
  setInlineStyle('replay-in-iframe', "padding: 0;margin:0;width: 100%;position: absolute;z-index: 1;top:0;left:0;height: 100%;0.5s");  
  setInlineStyle('fullscreen-mode', "display: inline-block; position: absolute; z-index: 2; top: 0; right: 12px; height: 50px; width: 162px; background-color: transparent; box-shadow: none !important; 0.5s");  
}

// closes replay page on fullscreen
function closesFullScreen() {
  setInlineStyle('replay-in-iframe', "padding: 0; margin: 101px 0 0 0; max-width: 100%;  width: inherit; 0.5s");  
  setInlineStyle('fullscreen-mode', "display: none; transition: 0.5s");  
}

// shows replay table menu results and hide list menu results
function showTable() {
  var showTable = urlParam('table-results');
  if(showTable == "show-table") {
  setInlineStyle('replay-menu-table', "display: block");  
  setInlineStyle('replay-menu-list', "display: none");  
 }
}

// shows replay list menu results and hide table menu results
function showList() {
  var showTable = urlParam('table-results');
  if(showTable == "show-list") {
  setInlineStyle('replay-menu-list', "display: block");  
  setInlineStyle('replay-menu-table', "display: none");  
 }
}

// removes shadow from search input: homepage, page and image pages
function removeSearchBoxShadow() {
  setInlineStyle('submit-search-input', "-webkit-box-shadow: 0px 0px 0px 0px rgba(255 255 0 / 0%);box-shadow: 0px 0px 0px 0px rgba(255 255 0 / 0%);");
}

// shows shadow from search input: homepage, page and image pages
function showsSearchBoxShadow() {
  setInlineStyle('submit-search-input', "-webkit-box-shadow: 0px 4px 5px -2px rgba(0 0 0 / 25%);box-shadow: 0px 4px 5px -2px rgba(0 0 0 / 25%);");
}

// shows image technical details window that stays on top of modal image
function openImageDetailsModalWindow() {
  setInlineStyle('modal-window-image-technical-details', "display: block;transition:0.5s");
  setInlineStyle('close-modal-tecnhical', "display:block; transition:0.5s");  
}

// closes image technical details window that stays on top of modal image
function closeImageDetailsModalWindow() {
  setInlineStyle('modal-window-image-technical-details', "display:none; transition:0.5s");   
  setInlineStyle('close-modal-tecnhical', "display:none; transition:0.5s");   
}


// Month names for dateFromTimestamp, by page language (the global `lang`, set in
// views/templates/translatelibs.ejs). They are the jQuery UI datepicker names the dates
// used before, so this file does not need jQuery UI:
// - pt: jQuery.datepicker.regional.pt, which translatelibs.ejs sets from translations/libs.yml.
// - en: jQuery UI's own English names (jQuery.datepicker.regional.en).
// __tests__/public-js/functions.test.js checks that they still match.
const MONTH_NAMES = {
  pt: {
    monthNames: ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"],
    monthNamesShort: ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"],
  },
  en: {
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
  },
};

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
    return MONTH_NAMES[lang].monthNamesShort[parseInt(month)-1];
  }
  let longMonth = function(month){
    return MONTH_NAMES[lang].monthNames[parseInt(month)-1];
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

function onSectionLoad(loadMessage,callback){
  const eventMethod = window.addEventListener ? "addEventListener" : "attachEvent";
  const messageEvent = eventMethod == "attachEvent" ? "onmessage" : "message";
  window[eventMethod](messageEvent, (e) => {
      const key = e.message ? "message" : "data";
      if(e[key] && e[key].arquivo_type && e[key].message){
          if(e[key].arquivo_type == 'section-loaded' && e[key].message == loadMessage){
              callback();
          }
      }
  }, true);
}

function isValidUrl(url) {
  if(typeof url !== 'string') { return false;}
  const urlPattern = /^\s*(((http|https):\/\/)?([a-zA-Z\d][-\w\.]*)\.([a-zA-Z\.]{2,6})([-\/\w\p{L}\.~,;:%&=?!+$#*@\(?\)?]*)\/?)\s*$/
  return urlPattern.test(url);
};