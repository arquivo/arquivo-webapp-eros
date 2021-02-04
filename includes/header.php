<header>  
<button id="nav-menu-button" class="button" value="top navigation left menu" onclick="openLeftMenuNav()">Menu</button>  
<a href="#">
  <img id="logo-arquivo" src="assets/img/arquivo-logo-white.svg" alt="Arquivo.pt">
</a>
<!-- Include left and right nav -->
<?php include_once("left_nav_menu.php")?>
<?php include_once("right_nav_menu.php")?>
<!-- starts white background top corner rounded shape -->
<div class="background-top-curve"></div>
<!-- ends white background top corner rounded shape -->
</header>

<!-- starts search tools section -->
<section id="search-tools">
<h3>Search Tools</h3>
<!-- starts search tools input -->
<form id="search-form" action="search-query.php" method="get">
<h4>Search input</h4>
  <span class="search-input-button"><input type="search" placeholder="Words or URL" autocapitalize="off" autocomplete="off">
  <button id="submit-search" type="submit">Search</button></span>
<!-- ends search tools input -->

  <!-- starts ionic slider --> 
  <section id="search-tools-date-slider"> 
  <h4>Search Date Slider</h4>
  <script>
    document.write('<ion-range ion-padding-start id="dual-range" dual-knobs pin color="dark" min="'+minYear+'" max="'+maxYear+'" step="1">');
  </script>
  <ion-range ion-padding-start="" id="dual-range" dual-knobs="" pin="" color="dark" min="1996" max="2021" step="1" class="ion-color ion-color-dark md in-item range-has-pin hydrated">
    <button type="button" class="clean-button-no-fill" id="sliderCircleRight" onclick="openDateEnd();" slot="end"> 
    <script>
       document.write('<span id="calendarDayRight">'+removeZeroInDay("31")+'</span>'+
       '<br>'+
       '<span id="calendarMonthRight">'+getMonthShortName("12")+'</span><br>'+ 
       '<span id="calendarYearRight">2021</span>');
    </script><span id="calendarDayRight">31</span><br>    
    <span id="calendarMonthRight">dez</span><br>
    <span id="calendarYearRight">2021</span> </button>
    <input size="10" class="display-none" type="text" id="dateStart_top" name="dateStart" value="01/01/1998">
    <input size="10" class="display-none" type="text" id="dateEnd_top" name="dateEnd" value="31/12/2018">
    <button type="button" class="clean-button-no-fill" id="sliderCircleLeft" slot="start" onclick="openDateStart()"> 
    <script>
       document.write('<span id="calendarDayLeft">'+removeZeroInDay("01")+'</span><br>');
       document.write('<span id="calendarMonthLeft">'+getMonthShortName("01")+'</span>');
    </script><span id="calendarDayLeft">1</span><br>
    <span id="calendarMonthLeft">jan</span> <br>
    <span id="calendarYearLeft">1996</span> </button>
    <script>
        function openDateStart(){
             $('#ionDateStart').click();
             return;        
             }       
        function openDateEnd(){
             $('#ionDateEnd').click();
        return;        
       }                                              
    </script> 
  </ion-range>
  </section>
  <!-- ends ionic slider -->
      
</form>
<!-- starts search tools buttons -->
<section id="search-tools-buttons">
  <h4>Search Pages and Images Buttons</h4>
  <form id="search-form-pages" class="buttons" action="/pages/" method="get">
    <button type="submit" value="Pages">Pages</button>
  </form>
  <form id="search-form-images" class="buttons" action="/images" method="get">
    <button type="submit" value="Images">Images</button>
  </form>
  <form id="search-form-advanced" class="buttons" action="advanced-search" method="get">
    <button type="submit" value="Advanced Search">Advanced Search</button>
  </form>
</section>
<!-- ends search tools buttons -->
<!-- ends search tools section -->
</section>