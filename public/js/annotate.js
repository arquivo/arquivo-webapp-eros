'use strict';

// Everything is private to this function, except the functions that the buttons added
// below call from their onclick attributes.
(function () {
    var redB = "rgba(255,0,0,0.4)"
    var red = "rgba(255,0,0)"
    var yellowB = "rgba(255,255,0,0.4)"
    var yellow = "rgba(255,255,0)"
    var greenB = "rgba(0,255,0,0.4)"
    var green = "rgba(0,255,0)"
    var gray = "rgba(200,200,200)"
    var black = "rgba(0,0,0,0.4)"
    var blackB = "rgba(0,0,0,0.8)"



    var type = null
    var div = null
    var divResId = null
    var divChild = null
    var nRows = null
    var queryString = null

    var relevance = {
        "-2": {"color": black, "colorB": blackB, "value": "Conteúdo inacessível", "fontColor": gray}, 
        "-1": {"color": gray, "colorB": gray, "value": "Não anotado"}, 
        "0": {"color": red, "colorB": redB, "value": "Não relevante"}, 
        "1": {"color": yellow, "colorB": yellowB, "value": "Parcialmente relevante"}, 
        "2": {"color": green, "colorB": greenB, "value": "Muito relevante"}
    }

    var defaultRelevance = -1
    var selectedPosition = 0

    // The result cards the keyboard navigation moves through: the divChild children of divResId.
    function annotationCards(){
        var cards = []
        if (divResId) {
            document.querySelectorAll(divResId).forEach(function (parent) {
                cards.push.apply(cards, parent.querySelectorAll(':scope > ' + divChild))
            })
        }
        return cards
    }

    function changeRelevance(relevanceLocal, id){
        var results = JSON.parse(window.localStorage.getItem('annotations'))
        results[type]["queries"][queryString]["results"][id]["relevance"] = relevanceLocal
        window.localStorage.setItem('annotations', JSON.stringify(results))
        // Every element with this id (there can be several), compared as text instead of put in a selector.
        document.querySelectorAll('[id]').forEach(function (element) {
            var card = element.id === String(id) && element.parentElement && element.parentElement.parentElement
            if (card) {
                card.setAttribute("style", "background-color: " + relevance[relevanceLocal].colorB +" !important;");
            }
        })
    }


    function prepareAnnotator(type, div){
        console.log("prepareAnnotator")

        var storage = window.localStorage.getItem('annotations')
        var results = {"image": {"queries": {}}, "page": {"queries": {}}}
        if (storage)
            results = JSON.parse(storage)

        if (!results[type]["queries"][queryString]){
            results[type]["queries"][queryString] = {}
            results[type]["queries"][queryString]["results"] = {}
        }

        document.querySelectorAll(div).forEach(function( card ) {
            var position = null
            var id = null
            var metadata = {}
            if (type == 'page'){
                position = parseInt(card.getAttribute("data-index")) + parseInt((new URLSearchParams(window.location.search)).get('offset') ?? 0)
                var overlayLinks = card.querySelectorAll("a.overlay-link")
                id = overlayLinks[0].href.split("/").slice(6).join('/')
                metadata["url"] = id.split("/").slice(1).join('/')
                metadata["timestamp"] = id.split("/")[0]
                metadata["position"] = position
                overlayLinks.forEach(function (link) {
                    link.setAttribute("style","height:calc(100% - 100px)");
                })
            } else if (type == 'image'){
                position = parseInt(card.getAttribute("data-index")) + parseInt((new URLSearchParams(window.location.search)).get('offset') ?? 0)
                //<li class="image-card" id="image-card-1" data-index="1" data-tstamp="20170624094538" data-url="http://www.primebrands.pt/uploads/marcas/teste/59381b31bfd5d.jpg">
                // A missing attribute gives undefined (not null), as jQuery's .attr() did.
                id = document.getElementById("image-card-" + position)?.querySelector("img")?.getAttribute("src") ?? undefined
                metadata["url"] = card.getAttribute("data-url") ?? undefined;//id.split("/").slice(1).join('/')
                metadata["timestamp"] = card.getAttribute("data-timestamp") ?? undefined;//id.split("/")[0].substring(0,"20081029060647".length)
                //id = metadata["timestamp"] + '/' + metadata["url"]
                metadata["position"] = position
            }

            var buttonDiv = document.createElement('div')
            card.appendChild(buttonDiv)
            for (var relevanceLocal=-2; relevanceLocal < 3; relevanceLocal++){
                if (relevanceLocal != -1){
                    var button = document.createElement('input')
                    button.type = 'button';
                    button.id = position+relevance[relevanceLocal].value;
                    button.alt = relevanceLocal
                    button.value = relevance[relevanceLocal].value;
                    button.style = "height: 70px; margin-top: 10px; width: 25%; background-color: " + relevance[relevanceLocal].colorB + "; color:" + (relevance[relevanceLocal].fontColor ?? "black")
                    button.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        var relevanceLocal = parseInt(this.getAttribute("alt"))
                        changeRelevance(relevanceLocal, id)
                    }, false);
                    buttonDiv.appendChild(button)
                }
            }
            var divId = document.createElement('div')
            divId.id = id
            divId.setAttribute('class', 'ids');

            buttonDiv.appendChild(divId)

            if (!results[type]["queries"][queryString]["results"][id]){
                var relevanceLocal = defaultRelevance
                results[type]["queries"][queryString]["results"][id] = {}
                results[type]["queries"][queryString]["results"][id]["relevance"] = relevanceLocal
                results[type]["queries"][queryString]["results"][id]["metadata"] = metadata
                window.localStorage.setItem('annotations', JSON.stringify(results))
            } else {
                var relevanceLocal = results[type]["queries"][queryString]["results"][id]["relevance"]
            }
            changeRelevance(relevanceLocal, id)

        })

        window.localStorage.setItem('annotations', JSON.stringify(results))
    }

    function toggleRelevance(diff){
        var card = annotationCards()[selectedPosition]
        var id = ""
        if (type == 'page'){
            id = card.querySelector("a").href.split("/").slice(6).join('/')
        } else if (type == 'image'){
            id = card.querySelector("img").getAttribute("data-src").split("/").slice(4).join('/')
        }
        var results = JSON.parse(window.localStorage.getItem('annotations'))
        var relevanceLocal = (results[type]["queries"][queryString]["results"][id]["relevance"]+diff)%(Object.keys(relevance).length-1)
        if (relevanceLocal < 0)
            relevanceLocal = Object.keys(relevance).length-2
        changeRelevance(relevanceLocal, id)
    }

    function turnOffAnnotations(){
        window.localStorage.setItem('annotate', "false");
        window.location.href = window.location.href.replace(/[&\?]annotate=true/,'');
    }

    function toggleKeyboardNavigation(){
        const annotateKeyboard = (window.localStorage.getItem('annotateKeyboard') == "true")
        window.localStorage.setItem('annotateKeyboard', !annotateKeyboard);
    }

    function exportAnnotations() {

        var filename = "annotations.json"
        let original = JSON.parse(window.localStorage.getItem('annotations'));
        let output = JSON.parse(window.localStorage.getItem('annotations'));
        if (output?.page?.queries !== undefined){
            output.page.queries = Object.keys(original.page.queries).map(k => {
                let obj = {"query":k, ...original.page.queries[k]}
                obj.results = Object.keys(original.page.queries[k].results).map(id => ({id,...original.page.queries[k].results[id]}))
                return obj;
            }) 
        }

        if (output?.image?.queries !== undefined){
            output.image.queries = Object.keys(original.image.queries).map(k => {
                let obj = {"query":k, ...original.image.queries[k]}
                obj.results = Object.keys(original.image.queries[k].results).map(id => ({id,...original.image.queries[k].results[id]}))
                return obj;
            }) 
        }

        var text = JSON.stringify(output, null, 2);
        var element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
        element.setAttribute('download', filename);

        element.style.display = 'none';
        document.body.appendChild(element);

        element.click();

        document.body.removeChild(element);
      }

    function changePosition(position, childrenCount){
        if (position < 0){
            position = childrenCount+position
        } else {
            position = position%childrenCount
        }

        var cards = annotationCards()
        if (cards[selectedPosition]) {
            cards[selectedPosition].style.borderWidth = "0px";
        }
        selectedPosition = position
        cards[selectedPosition].style.borderWidth = "5px";
        cards[selectedPosition].style.borderColor = "black";
        cards[selectedPosition].scrollIntoView(false);
    }

    function clearAnnotations(){
        if(confirm("Tem a certeza que quer apagar TODAS as anotações feitas até agora, incluindo com outros termos de pesquisa? Considere exportar as anotações antes de apagar.")){
            window.localStorage.removeItem('annotations');
            window.location.reload();
        }
    }


    (function (init) {
        // Like jQuery's $(document).ready: on DOMContentLoaded (after jQuery's own ready callbacks), or
        // straight away if the DOM is already parsed, where jQuery 1.12 deferred with setTimeout.
        // Loaded in <head>, this script sees no difference.
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    })(function() {

        const urlQueryString = window.location.search;
        const urlParams = new URLSearchParams(urlQueryString);
        const annotateQS = urlParams.get('annotate')
        queryString = document.getElementById("submit-search-input").value + " " + document.getElementById("start-date").value + " " + document.getElementById("end-date").value

        if (annotateQS == "true"){
            window.localStorage.setItem('annotate', "true");
        }

        const annotate = (window.localStorage.getItem('annotate') == "true")
        console.log("ANNOTATE: "+ annotate);
        if (annotate){
            ['search-form-pages', 'search-form-images', 'search-tools-narrative-button'].forEach(function (id) {
                var element = document.getElementById(id)
                if (element) {
                    element.style.display = 'none';
                }
            })

            // <a id="..." style="..." href="#" onclick="..."><button>label</button></a>
            const annotationsButton = function(id, style, onclick, label){
                var link = document.createElement('a')
                link.setAttribute("id", id)
                link.setAttribute("style", style)
                link.setAttribute("href", "#")
                link.setAttribute("onclick", onclick)
                var button = document.createElement('button')
                button.textContent = label
                link.appendChild(button)
                return link
            };

            var clearAnnotationsButton = annotationsButton("clearAnnotationsButton", "margin-left:-7px", "clearAnnotations()", "Limpar anotações")
            var exportAnnotationsButton = annotationsButton("exportAnnotationsButton", "margin-left: 5px;", "exportAnnotations()", "Exportar anotações")
            var turnOffAnnotationsButton = annotationsButton("turnOffAnnotationsButton", "margin-left:5px", "turnOffAnnotations()", "Desligar modo anotação")

            const urlqueryString = window.location.search;
            const urlParams = new URLSearchParams(urlqueryString);
            var startValue = urlParams.get('offset')

            if (startValue == null){
                startValue = 0
            } else {
                startValue = parseInt(startValue)
            }
            startValue += 1

            let api = urlParams.get('api');
            if(!!api){
                let apiInput = document.createElement('input');
                apiInput.setAttribute('type','hidden');
                apiInput.setAttribute('name','api');
                apiInput.setAttribute('value',api);
                document.getElementById('search-form')?.appendChild(apiInput);
            }

            var nRes = 0
            if (window.location.href.includes("/image/search")){
                type = "image";
                div = "li.image-card";
                divResId = "image-cards-container";
                divChild = "li.image-card";
                nRows = 3;
                nRes = parseInt((new URLSearchParams(window.location.search)).get('maxItems') ?? "24");
            } else if (window.location.href.includes("/page/search")){
                type = "page";
                div = "ul.page-search-result";
                divResId = "#pages-results";
                divChild = "ul";
                nRows = 10;
                nRes = parseInt((new URLSearchParams(window.location.search)).get('maxItems') ?? "10");
            }

            var start = document.createElement('p')
            start.setAttribute("id", "startend")
            var startEnd = document.createElement('span')
            startEnd.textContent = startValue + " até " + (startValue+nRes-1)
            start.appendChild(startEnd)
            start.setAttribute("style", "margin-left: 60px; margin-top: 5px;");

            document.getElementById("search-tools-buttons")?.append(clearAnnotationsButton, exportAnnotationsButton, turnOffAnnotationsButton, start)

            var interval = window.setInterval(function(){
                if (div && document.querySelectorAll(div).length > 0){
                    clearInterval(interval)
                    prepareAnnotator(type, div)
                }
            }, 500);

            // Give every result that is not annotated yet this relevance.
            const annotateUnannotated = function(relevanceLocal){
                if (!divResId) return
                document.querySelectorAll(divResId).forEach(function (parent) {
                    parent.querySelectorAll(".ids").forEach(function (divId) {
                        var results = JSON.parse(window.localStorage.getItem('annotations'))
                        if (results[type]["queries"][queryString]["results"][divId.id]["relevance"] == -1)
                            changeRelevance(relevanceLocal, divId.id)
                    })
                })
            };

            document.addEventListener('keydown', function(event) {
                if (event.code == 'F1') {
                    toggleKeyboardNavigation()
                } else if (window.localStorage.getItem('annotateKeyboard') == "true") {
                    var childrenCount = annotationCards().length
                    var nCols = Math.ceil(childrenCount/nRows)
                    if (event.code == 'KeyW') {
                        changePosition(selectedPosition-nCols, childrenCount)
                    } else if (event.code == 'KeyS') {
                        changePosition(selectedPosition+nCols, childrenCount)
                    } else if (event.code == 'KeyA') {
                        changePosition(selectedPosition-1, childrenCount)
                    } else if (event.code == 'KeyD') {
                        changePosition(selectedPosition+1, childrenCount)
                    } else if (event.code == 'KeyQ') {
                        toggleRelevance(1)
                    } else if (event.code == 'KeyE') {
                        toggleRelevance(-1)
                    } else if (event.code == 'Digit1') {
                        annotateUnannotated(0)
                    } else if (event.code == 'Digit2') {
                        annotateUnannotated(1)
                    } else if (event.code == 'Digit3') {
                        annotateUnannotated(2)
                    } else if (event.code == 'KeyR') {
                        document.location = document.getElementById("nextImage").children[0].href
                    } else if (event.code == 'KeyT') {
                        document.location = document.getElementById("previousImage").children[0].href
                    }
                }
            });
        }
    })

    window.clearAnnotations = clearAnnotations;
    window.exportAnnotations = exportAnnotations;
    window.turnOffAnnotations = turnOffAnnotations;
})();
