<!-- starts options nav menu -->
<nav id="options-right-nav">
<h3>options menu navigtion</h3> 
<button id="options-nav-close-button" onclick="closeOptionsMenuNav()"><span>&times;</span></button>
<section>
  <h4>Right menu navigation list</h4>
    <ul>      
      <li><a href="#"><span class="fas fa-file-download" aria-hidden="true"></span>Export results (XLSX)</a></li>
      <li><a href="#"><span class="fas fa-file-download" aria-hidden="true"></span>Export results (CSV)</a></li>
      <li><a href="#"><span class="fas fa-file-download" aria-hidden="true"></span>Export results (ODS)</a></li>
      <li><a href="#"><span class="fas fa-file-download" aria-hidden="true"></span>Export results (TXT)</a></li> 
    </ul>
</nav>
<!-- ends options nav menu -->
<!-- starts accordion -->  
<script>
var acc = document.getElementsByClassName("accordion");
var i;

for (i = 0; i < acc.length; i++) {
  acc[i].addEventListener("click", function() {
    this.classList.toggle("active");
    var panel = this.nextElementSibling;
    if (panel.style.maxHeight) {
      panel.style.maxHeight = null;
    } else {
      panel.style.maxHeight = panel.scrollHeight + "px";
    } 
  });
}
</script>
<!-- ends accordion --> 
