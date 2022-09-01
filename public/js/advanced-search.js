$(() => {
    const form = $('form.advanced-search-form');
    const formatInput = form.find('input[name=type]').first();
    const siteInput = form.find('input[name=siteSearch]').first();
    form.submit(function(e) {
        let checkedTypes = form.find('input[format]:checked').toArray().map(x => $(x).attr('format'));
        if(checkedTypes.some(x => x == 'all')){
            formatInput.val('all')
        } else {
            formatInput.val(checkedTypes.join(','));
        }
        let siteSearch = siteInput.val();
        if(siteSearch){
            siteInput.val(siteSearch.split(/\s/).join(''));
        }

        return true;
    })

    const allCheckbox = form.find('input[format="all"]');
    const otherCheckboxes = form.find('input[format]:not([format="all"])');

    allCheckbox.change(function(){
        otherCheckboxes.prop("checked", this.checked );
    });
    otherCheckboxes.change(function(){
        if(!this.checked){
            allCheckbox.prop("checked",false);
        } else if(otherCheckboxes.toArray().every(x => x.checked)){
            allCheckbox.prop("checked",true);
        }
    });
    
    $('table#table-format label').click(function(e){
        $(e.target).closest('td').prev().find('input').click();
    })
});