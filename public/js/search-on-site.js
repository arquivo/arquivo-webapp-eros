'use strict';

// "Search on site" modal of the replay options menu (#search-on-site in
// views/templates/header/header-replay.ejs): searches the pages or images of the host
// of the page shown in the replay. The modal is a GET form; this script fills its
// hidden q field with "site:<host> <terms>" when it is submitted.
(() => {
    const $id = (id) => document.getElementById(id);

    // The host of a URL, without a leading www. (unless that leaves a bare top-level domain).
    const hostOf = (url) => {
        try {
            return new URL(url).hostname.replace(/^www\.(?=[^.]+\.)/, '');
        } catch {
            return '';
        }
    };

    // Same event as ArquivoReplay.sendToAnalytics in replay.js.
    const sendToAnalytics = (action) => {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            "event": 'replay_interaction',
            "event_category": 'ReplayBarFunctions',
            "event_action": action,
            "event_label": 'arquivo.pt' + window.location.pathname.replace(/^\/wayback/, ''),
        });
    };

    const init = () => {
        const modal = $id('search-on-site');
        const form = $id('search-on-site-form');
        const menuLink = $id('menuSearchOnSite');
        if (!modal || !form || !menuLink) {
            return;
        }
        const terms = $id('search-on-site-terms');
        const subdomains = $id('search-on-site-subdomains');
        const imagesButton = $id('search-on-site-images');
        const searchButtons = [$id('search-on-site-pages'), imagesButton];
        let host = '';

        const updateButtons = () => {
            const disabled = !host || !terms.value.trim();
            searchButtons.forEach((button) => { button.disabled = disabled; });
        };

        // Runs before jquery-modal opens the modal. The host is read here because
        // replay.js updates #menuUrl on each navigation inside the replay.
        menuLink.addEventListener('click', () => {
            sendToAnalytics('SearchOnSiteClick');
            const menuUrl = $id('menuUrl');
            host = hostOf(menuUrl ? menuUrl.textContent.trim() : '');
            $id('search-on-site-host').textContent = host;
            $id('search-on-site-hint-host').textContent = '.' + host;
            // Subdomains of an IP address do not exist.
            const isIpAddress = /^\[|^[\d.]+$/.test(host);
            $id('search-on-site-subdomains-option').hidden = isIpAddress;
            if (isIpAddress) {
                subdomains.checked = false;
            }
            updateButtons();
        });

        terms.addEventListener('input', updateButtons);

        // Enter in the input submits with the first submit button, Pages.
        form.addEventListener('submit', (e) => {
            const value = terms.value.trim();
            if (!host || !value) {
                e.preventDefault();
                return;
            }
            // The site: term goes first so that a site: typed by the user does not replace it.
            $id('search-on-site-query').value = 'site:' + (subdomains.checked ? '*.' : '') + host + ' ' + value;
            sendToAnalytics(e.submitter === imagesButton ? 'SearchOnSiteImagesClick' : 'SearchOnSitePagesClick');
        });

        // Tab stays inside the modal.
        modal.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') {
                return;
            }
            const focusable = [...modal.querySelectorAll('input:not([type="hidden"]), button:not(:disabled), a[href]')]
                .filter((el) => !el.closest('[hidden]'));
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        });

        // jquery-modal opens and closes the modal, and closes it on Escape and on a
        // click outside it.
        const jQuery = window.jQuery;
        if (!jQuery || !jQuery.modal) {
            return;
        }
        $id('search-on-site-cancel').addEventListener('click', () => jQuery.modal.close());
        jQuery(modal)
            .on(jQuery.modal.OPEN, () => terms.focus())
            .on(jQuery.modal.AFTER_CLOSE, () => menuLink.focus());
    };

    // The script runs before the menu is parsed.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
