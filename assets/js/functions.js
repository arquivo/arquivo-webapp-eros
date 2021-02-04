// JavaScript Document

// starts menu opening and closing button for top nav menu button
function openLeftMenuNav() {
  document.getElementById("left-nav").style.cssText = "left:0px;"; 
 // document.getElementById("menu-overlay").style.cssText = "display:block;z-index:0;background: #000; opacity:0.5;";
}
function closeLeftMenuNav() {
  document.getElementById("left-nav").style.cssText = "left:-200x";
 // document.getElementById("menu-overlay").style.cssText = "display:none !important;z-index:-1;"; 
// ends menu opening and closing button for top nav menu button
}