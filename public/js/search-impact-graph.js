//Pure data transform: impact map (year -> raw score) -> per-year bar descriptors.
//Kept free of jQuery/DOM so it can be unit tested directly under Node.
function calculateImpactBars(impact, minYear, maxYear) {
    impact = impact || {};

    const years = [];
    for (let year = minYear; year <= maxYear; year++) {
        years.push(year);
    }

    const values = years.map((year) => Number(impact[year]) || 0);
    const sum = values.reduce((total, value) => total + value, 0);

    //Nothing to show: avoid a divide by zero and an empty-looking graph
    if (sum <= 0) {
        return null;
    }

    const percentages = values.map((value) => value / sum);
    const maxPercentage = Math.max(...percentages);

    return years.map((year, index) => {
        const value = values[index];
        const isZero = value <= 0;
        const percentage = percentages[index];
        const heightPercent = !isZero && maxPercentage > 0 ? (percentage / maxPercentage) * 100 : 0;
        const label = isZero ? null : year + ': ' + (percentage * 100).toFixed(2) + '%';

        return { year, value, percentage, heightPercent, label, isZero };
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { calculateImpactBars };
}

if (typeof $ !== 'undefined') {
    $(function () {
        const container = $('#search-impact-graph');

        //Make sure the target exists
        if (!container.length) {
            return;
        }

        const minYear = 1991;
        const maxYear = new Date().getFullYear();

        const tooltip = $('<div>').addClass('impact-bar-tooltip');

        const showTooltip = function (bar) {
            tooltip.text(bar.attr('data-label'));
            tooltip.css('left', bar.position().left + bar.outerWidth() / 2);
            tooltip.appendTo(container).show();
        };

        const hideTooltip = function () {
            tooltip.hide();
        };

        const renderImpactGraph = function () {
            container.empty();
            hideTooltip();

            const dataElement = $('#search-impact-timeline-json');
            if (!dataElement.length) {
                return;
            }

            let impact;
            try {
                impact = JSON.parse(dataElement.text() || '{}');
            } catch (e) {
                return;
            }

            const bars = calculateImpactBars(impact, minYear, maxYear);
            if (!bars) {
                return;
            }

            bars.forEach((bar) => {
                //Skip years with no impact entirely: no bar, just a spacer to keep alignment
                if (bar.isZero) {
                    $('<div>').addClass('impact-bar-spacer').appendTo(container);
                    return;
                }

                $('<div>')
                    .addClass('impact-bar')
                    .css('height', bar.heightPercent + '%')
                    .attr('aria-label', bar.label)
                    .attr('data-label', bar.label)
                    .on('mouseenter', function () {
                        showTooltip($(this));
                    })
                    .on('mouseleave', hideTooltip)
                    .appendTo(container);
            });
        };

        //Impact data only arrives once the AJAX search results section has loaded,
        //signalled by init.js via this same postMessage pattern.
        const eventMethod = window.addEventListener ? 'addEventListener' : 'attachEvent';
        const messageEvent = eventMethod === 'attachEvent' ? 'onmessage' : 'message';

        window[eventMethod](messageEvent, function (e) {
            const key = e.message ? 'message' : 'data';
            if (e[key] && e[key].arquivo_type === 'section-loaded' && e[key].message === 'search-results') {
                renderImpactGraph();
            }
        });
    });
}
