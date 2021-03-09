//////////////////////////////////////////////////////////////////////////////////////////////////////////
// JavaScript functions for Arquivo.pt ///////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////

// starts: menu opening and closing button for top nav left menu button //////////////////////////////////
function openLeftMenuNav() {
  document.getElementById("left-nav").style.cssText = "left:0px;"; 
}
function closeLeftMenuNav() {
  document.getElementById("left-nav").style.cssText = "left:-200px";
}
// ends: menu opening and closing button for top nav left menu button ////////////////////////////////////

// starts: menu opening and closing button for top nav right menu button  ////////////////////////////////

function openOptionstMenuNav() {
  document.getElementById("options-right-nav").style.cssText = "right:0px;"; 
}
function closeOptionsMenuNav() {
  document.getElementById("options-right-nav").style.cssText = "right:-200px";
}
// ends: menu opening and closing button for top nav right menu button ///////////////////////////////////

//////////////////////////////////////////////////
// REPLAY ////////////////////////////////////////
//////////////////////////////////////////////////


// starts: menu opening and closing button for top nav left replay menu button //////////////////////////////////
function openReplayLeftMenuNav() {
  document.getElementById("replay-left-nav").style.cssText = "left:0px;"; 
}
function closeReplayLeftMenuNav() {
  document.getElementById("replay-left-nav").style.cssText = "left:-200px";
}
// ends: menu opening and closing button for top nav left replay menu button ////////////////////////////////////

// starts: menu opening and closing button for top nav right replay menu button /////////////////////////////////
function openReplayRightMenuNav() {
    document.getElementById("replay-right-nav").style.cssText = "right:0px;"; 
}
function closeReplayRightMenuNav() {
    document.getElementById("replay-right-nav").style.cssText = "right:-200px";  
}
// ends: menu opening and closing button for replay top nav right replay menu button 

// starts: copy URL to clipboard on click 
function copyURlToClipboard() {
}
// ends: copy URL to clipboard on click 

// starts: alerts messages  

// alert message in
function alertsMessageIn() {
  document.getElementById("alert-container").style.cssText = "top:0;height:47px;opacity:1;transition:0.3s"; 
  setTimeout("document.getElementById('alert-container')", 2000); 
}
// alert message out
function alertsMessageOut() {
  document.getElementById("alert-container").style.cssText = "height:0px;opacity:0;transition:0.5s";     
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
