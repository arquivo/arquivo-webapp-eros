$(() => {
    const form = $('form#advanced-search-form-pages');
    const formatInput = form.find('input[name=format]').first();
    form.submit(function(e) {
        let checkedTypes = form.find('input[type=checkbox]:checked').toArray().map(x => $(x).attr('format'));
        if(checkedTypes.some(x => x == 'all')){
            formatInput.val('all')
        } else {
            formatInput.val(checkedTypes.join(','));
        }
        return true;
    })

    const allCheckbox = form.find('input[format="all"]');
    const otherCheckboxes = form.find('input[type=checkbox]:not([format="all"])');

    allCheckbox.change(function(){
        otherCheckboxes.prop("checked", this.checked );
    });
    otherCheckboxes.change(function(){
        if(!this.checked){
            allCheckbox.prop("checked",false);
        } else if(otherCheckboxes.toArray().filter(x => x.checked).length == otherCheckboxes.length){
            allCheckbox.prop("checked",true);
        }
    });
    
    $('table#table-format label').click(function(e){
        $(e.target).closest('td').prev().find('input').click();
    })
});