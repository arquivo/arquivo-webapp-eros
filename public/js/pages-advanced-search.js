$(() => {
    const form = $('form#advanced-search-form-pages');
    const formatInput = form.find('input[name=format]').first();
    form.submit(function(e) {
        let checkedTypes = form.find('input[type=checkbox]:checked').toArray().map(x => x.name).map(x => x.split('.').pop());
        if(checkedTypes.some(x => x == 'all')){
            formatInput.val('all')
        } else {
            formatInput.val(checkedTypes.join(','));
        }
        form.find('input[type=checkbox]').attr("disabled", "disabled")
        return true;
    })

    const allCheckbox = form.find('input[name="format.all"]');
    const otherCheckboxes = form.find('input[type=checkbox]:not([name="format.all"])');

    allCheckbox.change(function(){
        otherCheckboxes.prop("checked", this.checked );
    });
    otherCheckboxes.change(function(){
        if(!this.checked){
            allCheckbox.prop("checked",false);
        }else if(otherCheckboxes.find(':checked').length == otherCheckboxes.length){
            allCheckbox.prop("checked",true);
        }
    })
});