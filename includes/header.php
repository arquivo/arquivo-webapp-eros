<div id="branding"><a href="#"><img id="logo" src="assets/img/arquivo-logo-white.svg" title="Insert here dynamic text in Portuguese and English" alt="Insert here dynamic text in Portuguese and English"></a> </div>
<!-- starts content container -->
<div id="content-container">
<header> 
  <!-- starts nav menu general -->
  <nav id="homepage">
    <ul>
      <li>Home</li>
      <li>Copiar link</li>
      <li>P&aacute;ginas
        <ul>
          <li>Nova pesquisa</li>
          <li>Pesquisa avan&ccedil;ada</li>
        </ul>
      </li>
      <li>Imagens
        <ul>
          <li>Nova pesquisa</li>
          <li>Pesquisa avan&ccedil;ada</li>
        </ul>
      </li>
      <li>Sobre</li>
      <li>English</li>
    </ul>
  </nav>
  <!-- ends nav menu general --> 
  <!-- starts nav wayback -->
  <nav id="menuwayback">
    <ul>
      <li>Home</li>
      <li>Copiar link</li>
      <li>P&aacute;ginas
        <ul>
          <li>Nova pesquisa</li>
          <li>Pesquisa avan&ccedil;ada</li>
        </ul>
      </li>
      <li>Imagens
        <ul>
          <li>Nova pesquisa</li>
          <li>Pesquisa avan&ccedil;ada</li>
        </ul>
      </li>
      <li>Sobre</li>
      <li>English</li>
    </ul>
  </nav>
  <!-- ends nav wayback --> 
</header>
<!-- starts search bar, datepicker, slider, advanced search, search buttons: pages and images -->
<form id="searchForm" action="some_script_to_run_search" method="get">
  <input type="search" placeholder="Pesquisar ou escrever URL" autocapitalize="off" autocomplete="off">
  <button id="submit-search" type="submit"></button>
  <!-- ends search bar, datepicker, slider, advanced search, search buttons: pages and images --> 
  
  <!-- starts ionic slider --> 
  <script>
    document.write('<ion-range ion-padding-start id="dual-range" dual-knobs pin color="dark" min="'+minYear+'" max="'+maxYear+'" step="1">');
  </script>
  <ion-range ion-padding-start="" id="dual-range" dual-knobs="" pin="" color="dark" min="1996" max="2018" step="1" class="ion-color ion-color-dark md in-item range-has-pin hydrated">
    <button type="button" class="clean-button-no-fill" id="sliderCircleRight" onclick="openDateEnd();" slot="end"> 
    <script>
       document.write('<span id="calendarDayRight">'+removeZeroInDay("31")+'</span>'+
       '<br>'+
       '<span id="calendarMonthRight">'+getMonthShortName("12")+'</span><br>'+ 
       '<span id="calendarYearRight">2018</span>');
    </script><span id="calendarDayRight">31</span><br>    
    <span id="calendarMonthRight">dez</span><br>
    <span id="calendarYearRight">2018</span> </button>
    <input size="10" class="display-none" type="text" id="dateStart_top" name="dateStart" value="01/01/1998">
    <input size="10" class="display-none" type="text" id="dateEnd_top" name="dateEnd" value="31/12/2018">
    <button type="button" class="clean-button-no-fill" id="sliderCircleLeft" slot="start" onclick="openDateStart()"> 
    <script>
       document.write('<span id="calendarDayLeft">'+removeZeroInDay("01")+'</span><br>');
       document.write('<span id="calendarMonthLeft">'+getMonthShortName("01")+'</span>');
    </script><span id="calendarDayLeft">1</span><br>
    <span id="calendarMonthLeft">jan</span> <br>
    <span id="calendarYearLeft">1998</span> </button>
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
  <!-- ends ionic slider -->
</form>
<!-- ends search bar, datepicker, slider, advanced search, search buttons: pages and images --> 
<!-- starts pages, images and advanced search buttons -->
<div id="option-buttons">
  <a href="#" id="PageButton" class="Buttons">P&aacute;ginas</a>
  <a href="#"id="ImageButton" class="Buttons">Imagens</a>
  <a href="#" id="advancedSearchButton" class="Buttons">Pesquisa avan&ccedil;ada</a>
</div>
<!-- ends pages, images and advanced search buttons --> 

<!-- starts advanced search form -->
<div id="accordion">
  <h3>Palavras</h3>
  <div>
    <p>
    Mauris mauris ante, blandit et, ultrices a, suscipit eget, quam. Integer
    ut neque. Vivamus nisi metus, molestie vel, gravida in, condimentum sit
    amet, nunc. Nam a nibh. Donec suscipit eros. Nam mi. Proin viverra leo ut
    odio. Curabitur malesuada. Vestibulum a velit eu ante scelerisque vulputate.
    </p>
  </div>
  <h3>Data</h3>
  <div>
    <p>
    Sed non urna. Donec et ante. Phasellus eu ligula. Vestibulum sit amet
    purus. Vivamus hendrerit, dolor at aliquet laoreet, mauris turpis porttitor
    velit, faucibus interdum tellus libero ac justo. Vivamus non quam. In
    suscipit faucibus urna.
    </p>
  </div>
  <h3>Formato</h3>
  <div>
    <p>
    Nam enim risus, molestie et, porta ac, aliquam ac, risus. Quisque lobortis.
    Phasellus pellentesque purus in massa. Aenean in pede. Phasellus ac libero
    ac tellus pellentesque semper. Sed ac felis. Sed commodo, magna quis
    lacinia ornare, quam ante aliquam nisi, eu iaculis leo purus venenatis dui.
    </p>
    <ul>
      <li>List item one</li>
      <li>List item two</li>
      <li>List item three</li>
    </ul>
  </div>
  <h3>S&iacute;tio web</h3>
  <div>
    <p>
    Cras dictum. Pellentesque habitant morbi tristique senectus et netus
    et malesuada fames ac turpis egestas. Vestibulum ante ipsum primis in
    faucibus orci luctus et ultrices posuere cubilia Curae; Aenean lacinia
    mauris vel est.
    </p>
    <p>
    Suspendisse eu nisl. Nullam ut libero. Integer dignissim consequat lectus.
    Class aptent taciti sociosqu ad litora torquent per conubia nostra, per
    inceptos himenaeos.
    </p>
  </div>
   <h3>N&uacute;mero de resultados</h3>
  <div>
    <p>
    Cras dictum. Pellentesque habitant morbi tristique senectus et netus
    et malesuada fames ac turpis egestas. Vestibulum ante ipsum primis in
    faucibus orci luctus et ultrices posuere cubilia Curae; Aenean lacinia
    mauris vel est.
    </p>
    <p>
    Suspendisse eu nisl. Nullam ut libero. Integer dignissim consequat lectus.
    Class aptent taciti sociosqu ad litora torquent per conubia nostra, per
    inceptos himenaeos.
    </p>
  </div>
</div>
<!-- ends advanced search form --> 
