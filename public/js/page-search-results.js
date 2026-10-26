// This code is meant to allow text selection/highlighting on page search results.
// 
// Each result has an overlay anchor that covers the entire result card, to alow the user to 
//     click on the card to see the result. Natively, most browsers interpret "click and drag" 
//     on anchors as dragging the link instead of text selection.
// This code bypasses the overlay and implements the text selection, as well as prevent 
//     redirection on the click event for click duration longer than 
//     page_search_result_data.threshold milliseconds.

'use strict';

// The script's state, an explicit global as before (nothing else on the page reads it).
// The semicolon matters: the next line starts with "(".
window.page_search_result_data = {};
(function (init) {
    // Same timing as jQuery's $(fn): once the DOM is parsed, or now if it already is.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(function () {
    const page_search_result_data = window.page_search_result_data;
    page_search_result_data.lastMouseDown = 0;
    page_search_result_data.threshold = 300;
    page_search_result_data.selecting = false;
    page_search_result_data.selection = window.getSelection();
    page_search_result_data.range = document.createRange();
    page_search_result_data.start = null;
    page_search_result_data.end = null;

    // init.js loads the results into #pages-results after this runs, so the mousedown and
    // click handlers are delegated from it, as jQuery's .on(type, 'a.overlay-link', fn) was.
    const results = document.getElementById('pages-results');

    // The event target as jQuery reports it: a text node target becomes its parent.
    const targetOf = (e) => (e.target.nodeType === Node.TEXT_NODE ? e.target.parentNode : e.target);

    // Whether the event started in an a.overlay-link inside #pages-results. As in jQuery,
    // only the target and its ancestors below #pages-results can match.
    const fromOverlayLink = (e) => {
        const link = targetOf(e).closest('a.overlay-link');
        return !!link && link !== results && results.contains(link);
    };

    // jQuery's .css('pointer-events', value), which skips nodes without a style.
    const setPointerEvents = (el, value) => {
        if (el.style) { el.style.pointerEvents = value; }
    };

    results?.addEventListener('mousedown', (e) => {
        if (!fromOverlayLink(e)) { return; }
        if(e.button == 0){ //left mouse button
            e.preventDefault(); //fix for firefox
            page_search_result_data.lastMouseDown=new Date();
            page_search_result_data.selecting=true;
            setPointerEvents(targetOf(e),'none');
            page_search_result_data.start = getElementAndOffsetFromPoint(e.clientX,e.clientY);
            setPointerEvents(targetOf(e),'auto');
            page_search_result_data.selection.removeAllRanges();
            page_search_result_data.selection.addRange(page_search_result_data.range);
        }
    });
    document.body.addEventListener('mousemove',(e) => {
        if(page_search_result_data.selecting){
            if(targetOf(e).classList.contains('overlay-link')){
                setPointerEvents(targetOf(e),'none');
            }
                page_search_result_data.end = getElementAndOffsetFromPoint(e.clientX,e.clientY);
                updateSelection();
            if(targetOf(e).classList.contains('overlay-link')){
                setPointerEvents(targetOf(e),'auto');
            }
        }
    });
    addEventListener("mouseup", () => {
        page_search_result_data.selecting = false;
    });
    results?.addEventListener('click', (e) => {
        // jQuery runs delegated click handlers for the main button only.
        if (e.button > 0) { return; }
        if (!fromOverlayLink(e)) { return; }
        let lastMouseUp = new Date();
        if(lastMouseUp - page_search_result_data.lastMouseDown > page_search_result_data.threshold){
            //prevents following link if user was selecting text
            e.preventDefault();
            e.stopPropagation();
        }
    });

    // The helpers below are local to this function: nothing else on the page uses them.
    function getElementAndOffsetFromPoint(x,y){
        var el = document.elementFromPoint(x, y);
        var nodes = el.childNodes;
        for(let i=0; i<nodes.length;i++){
            let r = checkNode(nodes[i],x,y);
            if(!!r) { return r; }
        }
        return [el,0];
    }
    function checkNode(n, x, y){
        if (!checkNodePosition(n,x,y)){ return false; }
        if (n.nodeType != 3){
            if(!n.childNodes.length){ return [n,0]; }
            for(let i=0; i<n.childNodes.length;i++){
                let r = checkNode(n.childNodes[i],x,y);
                if(!!r) { return r; }
            }
            return [n,0];
        } else {
            const l = n.length;
            let r = document.createRange()
            let rect;
            for(let i=0; i<l; i++){
                r.setStart(n,i);
                r.setEnd(n,i+1);
                rect = r.getBoundingClientRect();
                if (x > rect.left && x < rect.right && y > rect.top && y < rect.bottom) {
                    return [n,i];
                }
            }
            return false;
        }
    }
    function checkNodePosition(n,x,y){
        var r = document.createRange();
        r.selectNode(n);
        var rect = r.getBoundingClientRect();
        if (x > rect.left && x < rect.right && y > rect.top && y < rect.bottom) {
            return true;
        }
        return false;
    }
    function updateSelection(){
        let start = page_search_result_data.start;
        let end = page_search_result_data.end;
        if(!start) { return; }
        if(!end) { return; }
        if(start[0].isSameNode(end[0])){
            if(start[1] > end[1]){
                start = page_search_result_data.end;
                end = page_search_result_data.start;
            }
        } else if ( start[0].compareDocumentPosition(end[0]) & Node.DOCUMENT_POSITION_PRECEDING ){
            start = page_search_result_data.end;
            end = page_search_result_data.start;
        }
        page_search_result_data.range.setStart(start[0],start[1]);
        page_search_result_data.range.setEnd(end[0],end[1]);
    }
});