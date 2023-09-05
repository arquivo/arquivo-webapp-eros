// This code is meant to allow text selection/highlighting on page search results.
// 
// Each result has an overlay anchor that covers the entire result card, to alow the user to 
//     click on the card to see the result. Natively, most browsers interpret "click and drag" 
//     on anchors as dragging the link instead of text selection.
// This code bypasses the overlay and implements the text selection, as well as prevent 
//     redirection on the click event for click duration longer than 
//     page_search_result_data.threshold milliseconds.

page_search_result_data = {}
$(() => {
    page_search_result_data.lastMouseDown = 0;
    page_search_result_data.threshold = 300;
    page_search_result_data.selecting = false;
    page_search_result_data.selection = window.getSelection();
    page_search_result_data.range = document.createRange();
    page_search_result_data.start = null;
    page_search_result_data.end = null;

    $('#pages-results').on('mousedown', "a.overlay-link", (e) => {
        if(e.button == 0){ //left mouse button
            e.preventDefault(); //fix for firefox
            page_search_result_data.lastMouseDown=new Date();
            page_search_result_data.selecting=true;
            $(e.target).css('pointer-events','none');
            page_search_result_data.start = getElementAndOffsetFromPoint(e.clientX,e.clientY);
            $(e.target).css('pointer-events','auto');
            page_search_result_data.selection.removeAllRanges();
            page_search_result_data.selection.addRange(page_search_result_data.range);
        }
    });
    $('body').on('mousemove',(e) => {
        if(page_search_result_data.selecting){
            if($(e.target).hasClass('overlay-link')){
                $(e.target).css('pointer-events','none');
            }
                page_search_result_data.end = getElementAndOffsetFromPoint(e.clientX,e.clientY);
                updateSelection();
            if($(e.target).hasClass('overlay-link')){
                $(e.target).css('pointer-events','auto');
            }
        }
    });
    addEventListener("mouseup", () => {
        page_search_result_data.selecting = false;
    });
    $('#pages-results').on('click', 'a.overlay-link', (e) => {
        let lastMouseUp = new Date();
        if(lastMouseUp - page_search_result_data.lastMouseDown > page_search_result_data.threshold){
            e.preventDefault();
            e.stopPropagation();
            return false; //prevents following link if user was selecting text
        }
    });

    getElementAndOffsetFromPoint = function (x,y){
        var el = document.elementFromPoint(x, y);
        var nodes = el.childNodes;
        for(let i=0; i<nodes.length;i++){
            let r = checkNode(nodes[i],x,y);
            if(!!r) { return r; }
        }
        return [el,0];
    }
    checkNode = function (n, x, y){
        if (!checkNodePosition(n,x,y)){ return false; }
        if (n.nodeType != 3){
            if(!n.childNodes.length){ return [n,0]; }
            for(let i=0; i<n.childNodes.length;i++){
                let r = checkNode(nodes[i],x,y);
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
    checkNodePosition = function(n,x,y){
        var r = document.createRange();
        r.selectNode(n);
        var rect = r.getBoundingClientRect();
        if (x > rect.left && x < rect.right && y > rect.top && y < rect.bottom) {
            return true;
        }
        return false;
    }
    updateSelection = function(){
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