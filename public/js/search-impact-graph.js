//Pure data transform: timeline ({impact, counts}, both year -> number) -> per-year bar descriptors.
//Kept free of jQuery/DOM so it can be unit tested directly under Node.
function calculateImpactBars(timeline, minYear, maxYear) {
    const impact = (timeline && timeline.impact) || {};
    const counts = (timeline && timeline.counts) || {};

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
        const percentageText = isZero ? null : (percentage * 100).toFixed(2) + '%';
        const count = Number(counts[year]) || 0;

        return { year, value, percentage, heightPercent, percentageText, count, isZero };
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

        const impactLabel = container.attr('data-impact-label');
        const resultsLabel = container.attr('data-results-label');
        const numberFormat = new Intl.NumberFormat(container.attr('data-locale') || undefined);

        //Lives on <body> so the slider's stacking context (z-index: 0) can't hide it behind other elements
        const tooltip = $('<div>').addClass('impact-bar-tooltip').hide().appendTo('body');

        //One line each: year, impact share and number of matching documents
        const tooltipLines = function (bar) {
            return [
                String(bar.year),
                impactLabel + ' ' + bar.percentageText,
                resultsLabel + ' ' + numberFormat.format(bar.count)
            ];
        };

        const showTooltip = function (element, bar) {
            tooltip.empty();
            tooltipLines(bar).forEach((line) => $('<div>').text(line).appendTo(tooltip));
            const offset = element.offset();
            tooltip.css({
                left: offset.left + element.outerWidth() / 2,
                top: offset.top + element.outerHeight() + 4
            }).show();
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

            let timeline;
            try {
                timeline = JSON.parse(dataElement.text() || '{}');
            } catch (e) {
                return;
            }

            const bars = calculateImpactBars(timeline, minYear, maxYear);
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
                    .attr('aria-label', tooltipLines(bar).join(', '))
                    .on('mouseenter', function () {
                        showTooltip($(this), bar);
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
