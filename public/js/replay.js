class ArquivoReplay {
    constructor(configs) {
        this.configs = configs;
        this.initCommunication()
        $(() => {
            this.init();
        })
    }

    getConfig(key) {
        return this.configs[key];
    }

    setConfig(key, value) {
        this.configs[key] = value;
    }

    sendToAnalytics(category,action,label) {
        const replay = this;
        if(!!ga){
            ga("send", "event", category, action, label || 'arquivo.pt/' + replay.getConfig('requestedPage.fullUrl'));
        }
    }

    init() {
        const replay = this;

        $('button.cancel').click((e) => {
            e.preventDefault();
            $.modal.close();
        });

        // Date selection menu
        $('#replay-left-nav').on('click', '.accordion-header', function (e) {
            e.preventDefault();
            let $this = $(this);
            if ($this.next().hasClass('show')) {
                $this.removeClass('active');
                $this.next().removeClass('show');
                $this.next().slideUp(150);
            } else {
                $this.toggleClass('active');
                $this.next().toggleClass('show');
                $this.next().slideToggle(150);
            }
        });

        $('#replay-left-nav').on('click', 'li.menu-pages-replay-date-hour', function (e) {
            e.preventDefault();
            const timestamp = $(this).find('a').attr('replay-timestamp');
            replay.setUrlAndTimestamp(replay.getConfig('requestedPage.url'),timestamp);
            replay.refreshIframe();

        });

        // Right menu
        $('#menuListVersions').click((e) => {
            e.preventDefault();
            replay.sendToAnalytics('ReplayBarFunctions', 'ListVersionsClick');
            window.location = this.href;
        }) 

        $('#menuTechnicalDetails').click((e) => {
            replay.sendToAnalytics('ReplayBarFunctions', 'MoreInformationMenuClick');
        })

        $('#menuScreenshot').click((e) => {
            replay.sendToAnalytics('ReplayBarFunctions', 'ScreenshotMenuClick');
        })

        $('#screenshot button.confirm').click(() => {
            replay.sendToAnalytics('ReplayBarFunctions', 'ScreenshotMenuConfirm');
            var requestURL = replay.getConfig('screenshot.url') + "?url=" + replay.getConfig('pywb.url') + '/' + replay.getConfig('requestedPage.fullUrl') + "&download=true&width=" + window.screen.width + "&height=" + window.screen.height;
            $.modal.close();
            window.open(requestURL, "_blank");
        });
        $('#screenshot button.cancel').click(() => {
            replay.sendToAnalytics('ReplayBarFunctions', 'ScreenshotMenuCancel');
        });

        $('#menuPrint').click((e) => {
            replay.sendToAnalytics('ReplayBarFunctions', 'PrintMenuClick');
        })

        $('#print button.confirm').click(() => {
            replay.sendToAnalytics('ReplayBarFunctions', 'PrintMenuConfirm');

            var requestURL = replay.getConfig('screenshot.url') + "?url=" + replay.getConfig('pywb.url') + '/' + replay.getConfig('requestedPage.fullUrl') + "&download=false";

            let divPrintMe = document.getElementById("divPrintMe");
            let imgElem = document.getElementById("imgToPrint");

            if (imgElem == null) {
                imgElem = document.createElement('img');
                imgElem.setAttribute("id", "imgToPrint");
                imgElem.setAttribute("width", "600px");
                imgElem.style.display = 'inherited';
                divPrintMe.appendChild(imgElem);
            }

            $.modal.close();
            $('#loading-screen').modal({ escapeClose: false, clickClose: false, showClose: false });
            imgElem.addEventListener('load', function () {
                $.modal.close();
                let printContents = document.getElementById("divPrintMe").innerHTML;
                let originalContents = document.body.innerHTML;

                document.body.innerHTML = printContents;

                window.print();

                document.body.innerHTML = originalContents;
            });
            imgElem.src = requestURL;
        });
        $('#print button.cancel').click(() => {
            replay.sendToAnalytics('ReplayBarFunctions', 'PrintMenuCancel');
        });

        $('#menuCompleteThePage').click((e) => {
            replay.sendToAnalytics('ReplayBarFunctions', 'Complete Page');
        })

        $('#complete-the-page button.confirm').click(() => {
            replay.sendToAnalytics('Complete Page', 'Clicked complete page and confirmed');
            window.open('/services/complete-page?url=' + replay.getConfig('requestedPage.url') + '&timestamp=' + replay.getConfig('requestedPage.timestamp'), '_blank');
            $.modal.close();
        });
        $('#complete-the-page button.cancel').click(() => {
            replay.sendToAnalytics('ReplayBarFunctions', 'ScreenshotMenuCancel');
        });

        $('#menuFullScreen').click((e) => {
            e.preventDefault();
            replay.sendToAnalytics('ReplayBarFunctions', 'ExpandClick');
            window.location = this.href;
        }) 

        $('#menuReplayWithOldBrowser').click((e) => {
            replay.sendToAnalytics('ReplayBarFunctions', 'Replay with old browser');
        })

        $('#replay-with-old-browser button.confirm').click(() => {
            replay.sendToAnalytics('Replay with old browser', 'Clicked replay with old browser and confirmed');
            window.open( replay.getConfig('oldweb.today.fullUrl') + '#' + replay.getConfig('pywb.url') + '/' + replay.getConfig('requestedPage.fullUrl'));
            $.modal.close();
        });


        //Left menu events
        $('#menu-language a').click((e) => {
            e.preventDefault();
            replay.sendToAnalytics('ReplayBarFunctions', 'ChangeLanguageTo'+(replay.getConfig('language') == 'pt' ? 'EN' : 'PT')+'Click');
            window.location = this.href;
        })
        $('#menu-pages-new-search a').click((e) => {
            e.preventDefault();
            replay.sendToAnalytics('ReplayBarFunctions', 'NewSearchClick');
            window.location = this.href;
        })
        $('#menu-pages-advanced-search a').click((e) => {
            e.preventDefault();
            replay.sendToAnalytics('ReplayBarFunctions', 'AdvancedSearchClick');
            window.location = this.href;
        })
        $('#menu-images-new-search a').click((e) => {
            e.preventDefault();
            replay.sendToAnalytics('ReplayBarFunctions', 'NewImageSearchClick');
            window.location = this.href;
        })
        $('#menu-images-advanced-search a').click((e) => {
            e.preventDefault();
            replay.sendToAnalytics('ReplayBarFunctions', 'AdvancedImageSearchClick');
            window.location = this.href;
        })
        $('#menu-savepagenow a').click((e) => {
            e.preventDefault();
            replay.sendToAnalytics('ReplayBarFunctions', 'SavePageNowClick');
            window.location = this.href;
        })
        $('#menu-about a').click((e) => {
            e.preventDefault();
            replay.sendToAnalytics('ReplayBarFunctions', 'AboutClick');
            window.location = this.href;
        })



        $('#search-other-archives button.confirm').click(() => {        
            window.open( 'https://web.archive.org/web/' + replay.getConfig('requestedPage.fullUrl'));
            $.modal.close();
        });

        window.onpopstate = function(e){
            if(e.state && e.state.url && e.state.timestamp){
                replay.setUrlAndTimestamp(e.state.url,e.state.timestamp,false);
                replay.refreshIframe();
            }
        };
    }

    setUrlAndTimestamp(url,timestamp,addToHistory = true){
        const replay = this;
        if((timestamp + '/' + url).replace(/\/+$/g, '') != replay.getConfig('requestedPage.fullUrl').replace(/\/+$/g, '')){
            replay.setConfig('requestedPage.timestamp', timestamp);
            replay.setConfig('requestedPage.fullUrl', timestamp + '/' + url);

            if(addToHistory && window.history && window.history.pushState){
                if(
                    window.history.state && window.history.state.url && window.history.state.timestamp && 
                    window.history.state.url.replace(/\/+$/g, '') == url.replace(/\/+$/g, '') && window.history.state.timestamp == timestamp
                ) {
                } else {
                    window.history.pushState(
                        { url: url, timestamp: timestamp },
                        document.title, 
                        '/wayback/'+ timestamp + '/' + url
                    );
                }
            }

            if (url != replay.getConfig('requestedPage.url')) {
                replay.setConfig('requestedPage.url', url);
                replay.updateFrame();
            } else {
                replay.updateTimestamp();
            }

            replay.updateMetadata();
        }
        
    }

    updateMetadata() {
        const replay = this;
        $('#technical-details').html(replay.getConfig('loader.html'));
        const url = replay.getConfig('requestedPage.url');
        const timestamp = replay.getConfig('requestedPage.timestamp');
        const fullUrl = replay.getConfig('requestedPage.fullUrl');
        $.ajax({
            url: '/partials/replay-technical-details?url=' + encodeURIComponent(url) + '&timestamp=' + encodeURIComponent(timestamp),
            success: (data, textStatus, jqXHR) => {
                if (replay.getConfig('requestedPage.fullUrl') == fullUrl) {
                    $('#technical-details').replaceWith(data); 
                }
            }
        });
    }

    initCommunication() {
        const replay = this;
        const eventMethod = window.addEventListener ? "addEventListener" : "attachEvent";
        const messageEvent = eventMethod == "attachEvent" ? "onmessage" : "message";

        window[eventMethod](messageEvent, (e) => {
            const key = e.message ? "message" : "data";
            if (e[key] && e[key].wb_type) {
                if (e[key].wb_type == 'load' && e[key].title && e[key].title + ' - ' + replay.getConfig('preservedByArquivo') != document.title) {
                    document.title = e[key].title + ' - ' + replay.getConfig('preservedByArquivo');
                }
                if ( ['load', 'replace-url', 'unload'].includes(e[key].wb_type) ) {
                    replay.setUrlAndTimestamp(e[key].url,e[key].ts,e[key].wb_type != 'load');
                    ga('send', 'pageview');
                }
                if ( e[key].wb_type == 'not-found' ) {
                    $('#replay-in-iframe').hide();
                    $('#replay-not-found').show();
                }
            }
            if(e[key] && e[key].arquivo_type && e[key].message){
                if(e[key].arquivo_type == 'section-loaded' && e[key].message == 'date'){
                    const target = $('.date-selected');
                    if(target.length){
                        const scrollTarget = target.scrollParent();
                        const height = scrollTarget.height(); 
                        const targetHeight = target.height();
                        const offset = target.offset().top;
                        scrollTarget[0].scrollTop = offset - height/2 - targetHeight;
                    }
                }
            }
        }, true);
    }

    updateFrame() {
        const replay = this;
        const url = replay.getConfig('requestedPage.url');
        const timestamp = replay.getConfig('requestedPage.timestamp');
        const fullUrl = replay.getConfig('requestedPage.fullUrl');

        $('#menuUrl').text(url);
        $('#menuTs').text(dateFromTimestamp(timestamp));
        $('#menuFullScreen').attr('href', replay.getConfig('pywb.url') + '/' + fullUrl);
        $('#chosen-url-a').text(url);
        $('#chosen-url-a').attr('href', replay.getConfig('pywb.url') + '/' + fullUrl);
        $('#chosen-url-date').text(dateFromTimestamp(timestamp));
        $('#menuListVersions').attr('href', '/page/search?q=' + url);
        const h3 = '<h3>' + $('#replay-left-nav > h3').html() + '</h3>';
        $('#replay-left-nav').html(h3 + replay.getConfig("loader.html"));
        $.ajax({
            url: '/partials/replay-nav?url=' + encodeURIComponent(url) + '&timestamp=' + encodeURIComponent(timestamp),
            success: (data, textStatus, jqXHR) => {
                if (replay.getConfig('requestedPage.fullUrl') == fullUrl) {
                    $('#replay-left-nav').html(h3 + data);                    
                    replay.updateSelection(true);
                }
            }
        });
    }
    updateTimestamp() {
        const replay = this;
        const timestamp = replay.getConfig('requestedPage.timestamp');
        const fullUrl = replay.getConfig('requestedPage.fullUrl');

        $('#menuTs').text(dateFromTimestamp(timestamp));
        $('#menuFullScreen').attr('href', replay.getConfig('pywb.url') + '/' + fullUrl);
        $('#chosen-url-a').attr('href', replay.getConfig('pywb.url') + '/' + fullUrl);
        $('#chosen-url-date').text(dateFromTimestamp(timestamp));
        replay.updateSelection();
    }

    updateSelection(rescroll = false){
        const timestamp = this.getConfig('requestedPage.timestamp');
        if($('#replay-left-nav .date-selected a').attr('replay-timestamp') != timestamp){
            $('#replay-left-nav .date-selected').removeClass('date-selected');
            const target = $('#replay-left-nav a[replay-timestamp='+timestamp+']').parent();
            target.addClass('date-selected');
            ['.accordion-replay-left-menu-day','.accordion-replay-left-menu-month','.accordion-replay-left-menu-year'].forEach((parentClass) => {
                const parent = target.closest(parentClass);
                if(!parent.hasClass('active')){
                    parent.addClass('active');
                }
            })
        }
        if(rescroll){
            const target = $('.date-selected').first();
            if(target.length){
                const scrollTarget = target.scrollParent();
                const height = scrollTarget.height();
                const targetHeight = target.height();
                const offset = target.offset().top;
                scrollTarget[0].scrollTop = offset - height / 2 - targetHeight;
            }
        }
    }

    refreshIframe(){
        const replay = this;
        let iframe = document.getElementById('replay-in-iframe');
        let frame = iframe.cloneNode();
        frame.src = replay.getConfig('pywb.url') + '/' + replay.getConfig('requestedPage.fullUrl');
        iframe.parentNode.replaceChild(frame, iframe);
    }
}
