<!-- starts left nav menu -->
<nav id="left-nav">
<h3>Left menu navigation</h3> 
<button id="left-nav-close-button" onclick="closeLeftMenuNav()"><span>&times;</span></button>
<section>
  <h4>Left menu navigation list</h4>
    <ul>
      <li id="menu-language"><a href="https://arquivo.pt/?&l=pt"><span class="fas fa-globe-americas" aria-hidden="true"></span>Portugu&ecirc;s</a></li>
      <li id="menu-copy-link"><a href="#"><span class="fas fa-copy" aria-hidden="true"></span>Copy link</a></li>
      <li id="menu-pages"><a href="javascript:(void)" class="accordion-left-menu"><span class="fas fa-pager" aria-hidden="true"></span>Pages</a>
        <ul class="panel">
          <li id="menu-pages-new-search"><a href="https://arquivo.pt/page/search?l=en"><span class="fas fa-search" aria-hidden="true"></span>New page search</a></li>
          <li id="menu-pages-advanced-search"><a href="https://arquivo.pt/page/advanced/search?l=en"><span class="fas fa-search-plus" aria-hidden="true"></span>Advanced page search</a></li>
        </ul>
      </li>
      <li id="menu-images"><a href="javascript:(void)" class="accordion-left-menu"><span class="fas fa-images" aria-hidden="true"></span>Images</a>
        <ul class="panel">
        <li id="menu-images-new-search"><a href="https://arquivo.pt/image/search?l=en"><span class="fas fa-search" aria-hidden="true"></span>New image search</a></li>
          <li id="menu-images-advanced-search"><a href="https://arquivo.pt/image/advanced/search?l=en"><span class="fas fa-search-plus" aria-hidden="true"></span>Advanced image search</a></li>
        </ul>   
      </li>
      <li id="menu-about"><a href="https://sobre.arquivo.pt/en/"><span class="fas fa-info-circle" aria-hidden="true"></span>About</a></li>  
    </ul>
</section>
</nav> 
<!-- starts accordion -->  
<script>
var acc = document.getElementsByClassName("accordion-left-menu");
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
<!-- ends left nav menu --> 
