// JavaScript Document

// MENU and OPTIONS button: left and right ////////////////////////////////////////

// starts menu opening and closing button for top nav left menu button
function openLeftMenuNav() {
  document.getElementById("left-nav").style.cssText = "left:0px;"; 
 // document.getElementById("menu-overlay").style.cssText = "display:block;z-index:0;background: #000; opacity:0.5;";
}
function closeLeftMenuNav() {
  document.getElementById("left-nav").style.cssText = "left:-200px";
 // document.getElementById("menu-overlay").style.cssText = "display:none !important;z-index:-1;"; 
// ends menu opening and closing button for top nav left menu button
}
// starts menu opening and closing button for top nav right menu button
function openOptionstMenuNav() {
  document.getElementById("options-right-nav").style.cssText = "right:0px;"; 
 // document.getElementById("menu-overlay").style.cssText = "display:block;z-index:0;background: #000; opacity:0.5;";
}
function closeOptionsMenuNav() {
  document.getElementById("options-right-nav").style.cssText = "right:-200px";
 // document.getElementById("menu-overlay").style.cssText = "display:none !important;z-index:-1;"; 
// ends menu opening and closing button for top nav right menu button
}
// starts menu opening and closing button for top nav right menu button
function openRightMenuNav() {
    document.getElementById("replay-right-nav").style.cssText = "right:0px;"; 
   // document.getElementById("menu-overlay").style.cssText = "display:block;z-index:0;background: #000; opacity:0.5;";
  }
  function closeRightMenuNav() {
    document.getElementById("replay-right-nav").style.cssText = "right:-200px";
   // document.getElementById("menu-overlay").style.cssText = "display:none !important;z-index:-1;"; 
  // ends menu opening and closing button for top nav right menu button
}
