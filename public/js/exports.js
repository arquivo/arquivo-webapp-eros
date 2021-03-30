$(function () {
    let _exportSERPInfo = [];
    let addZero = function (i) {
        if (i < 10) {
            i = "0" + i;
        }
        return i;
    }

    let jsDateToTimetamp = function (d = new Date()) {
        const sdate = [
            d.getFullYear(),
            ('0' + (d.getMonth() + 1)).slice(-2) +
            ('0' + d.getDate()).slice(-2),
            addZero(d.getHours()),
            addZero(d.getMinutes()),
            addZero(d.getSeconds()),
        ].join('');
        return sdate;
    }

    // Load a JavaScript file from the server using a GET HTTP request, then execute it.
    // Also use cache it.
    // adaptaion of cachedScript jQuery example on getScript
    // https://api.jquery.com/jquery.getscript/
    // let cachedScript =  function(url, callback, options) {

    //     // Allow user to set any option except for dataType, cache, and url
    //     options = $.extend( options || {}, {
    //         dataType: "script",
    //         cache: true,
    //         url: url
    //     });

    //     // Use $.ajax() since it is more flexible than $.getScript
    //     // Return the jqXHR object so we can chain callbacks
    //     jQuery.ajax( options ).done(function( script, textStatus ) {
    //         jQuery.globalEval(script);
    //         callback();
    //     });
    // }

    // Export the search engine result page.
    // type: image or page
    // outputFileExtension: csv or xlsx
    let exportSERP = function (type, outputFileExtension) {
        const wb = XLSX.utils.book_new();
        wb.Props = {
            Title: "Arquivo.pt search " + type + " export",
            Subject: "Arquivo.pt search " + type + " export",
            Author: "Arquivo.pt",
            CreatedDate: new Date()
        };
        const sheetName = type + " export";
        wb.SheetNames.push(sheetName);
        let _exportSERPInfo = JSON.parse($('#options-export-json').text())
        const ws = XLSX.utils.aoa_to_sheet(_exportSERPInfo);
        wb.Sheets[sheetName] = ws;
        const filename = "arquivo_pt_" + type + "_" + jsDateToTimetamp(new Date()) + "." + outputFileExtension;
        XLSX.writeFile(wb, filename);

        // ARQUIVO.sendEventToAnalytics('exportSERP', type, outputFileExtension);
    }

    // To be called after a search have been finished.
    // let exportSERPFinishSearch = function(type, totalResults) {
    //     document.getElementById("replayMenuButton").style.display = totalResults > 0 ? 'block' : 'none';
    const fileExtensions = ['xlsx', 'csv', 'ods', 'txt'];
    fileExtensions.forEach(fileExtension => {
        $('#options-export-' + fileExtension).click((e) => {
            e.preventDefault()
            if($('#options-export-json').length){
                exportSERP('page_search', fileExtension);

            }
        })
    });
    // }
});