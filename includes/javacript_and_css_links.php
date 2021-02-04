<!-- starts css styles links -->
<link rel="stylesheet"  type="text/css" href="assets/css/reset.css" media="screen">
<link rel="stylesheet"  type="text/css" href="assets/css/ionic.bundle.css" media="screen">

<link rel="stylesheet" type="text/css" href="assets/css/styles.css" media="screen">
<link rel="stylesheet" type="text/css" href="assets/css/print.css" media="print">
<!-- ends css styles links --> 

<!-- starts js functions -->
<script src="assets/js/functions.js"></script> 
<!-- ends js functions --> 

<!-- starts google fonts links -->
<link href="https://fonts.googleapis.com/css?family=Roboto:300,400,500,700&display=swap" rel="stylesheet">
<!-- ends google fonts links --> 

<!-- starts ionic slider javascript and css links --> 
<script type="module" src="https://cdn.jsdelivr.net/npm/@ionic/core@4.7.4/dist/ionic/ionic.esm.js"></script> 
<script nomodule src="https://cdn.jsdelivr.net/npm/@ionic/core@4.7.4/dist/ionic/ionic.js"></script>
<!-- ends ionic slider javascript and css --> 

<!-- starts jquery and slider css styles links -->
<script src="https://code.jquery.com/jquery-1.12.4.js"></script> 
<script src="https://code.jquery.com/ui/1.12.1/jquery-ui.js"></script> 
<!-- ends jquery and slider css styles --> 

<!-- starts accordion --> 
<script>
  $( function() {
    $( "#accordion" ).accordion({
      collapsible: true
    });
  });
  </script> 
<!-- ends accordion --> 

<!-- opens opening and closing advanced search form --> 
<script>
function openAdvancedSearchForm(){
 document.getElementById('accordion').style.display = "block";
 document.getElementById('closeAdvancedSearch').style.display = "block";
return false;
}

function closeAdvancedSearch(){
 document.getElementById('accordion').style.display = "none";
return false;
}
</script> 
<!-- ends opening and closing advanced search form --> 

<!-- starts Google Analytics (new version) --> 
<!--<script>
	(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
	(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
	m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
	})(window,document,'script','//www.google-analytics.com/analytics.js','ga');
	ga('create', 'UA-21825027-1', 'auto');
	ga('send', 'pageview');
</script> --> 
<!-- ends Google Analytics (new version)-->
