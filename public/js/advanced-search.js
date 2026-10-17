'use strict';

(function (init) {
    // Same timing as jQuery's $(fn): once the DOM is parsed, or now if it already is.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(() => {
    const form = document.querySelector('form.advanced-search-form');
    if (!form) {
        return;
    }
    const formatInput = form.querySelector('input[name=type]');
    const siteInput = form.querySelector('input[name=siteSearch]');
    form.addEventListener('submit', () => {
        let checkedTypes = Array.from(form.querySelectorAll('input[format]:checked'), x => x.getAttribute('format'));
        if (formatInput) formatInput.value = checkedTypes.includes('all') ? 'all' : checkedTypes.join(',');
        let siteSearch = siteInput?.value;
        if(siteSearch){
            siteInput.value = siteSearch.split(/\s/).join('');
        }
    });

    const allCheckboxes = form.querySelectorAll('input[format="all"]');
    const otherCheckboxes = Array.from(form.querySelectorAll('input[format]:not([format="all"])'));
    const setAllChecked = (checked) => allCheckboxes.forEach(x => { x.checked = checked; });

    allCheckboxes.forEach(allCheckbox => allCheckbox.addEventListener('change', function(){
        otherCheckboxes.forEach(x => { x.checked = this.checked; });
    }));
    otherCheckboxes.forEach(checkbox => checkbox.addEventListener('change', function(){
        if(!this.checked){
            setAllChecked(false);
        } else if(otherCheckboxes.every(x => x.checked)){
            setAllChecked(true);
        }
    }));
});
