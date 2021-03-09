$(function () {
    //Constants
    const minYear = 1996;
    const maxYear = (new Date()).getFullYear(); 
    const defaultDatepickerOptions = {
        dateFormat: "yy dd M",
        changeYear: true,
        changeMonth: true,
        minDate: new Date('01 Jan '+minYear),
        maxDate: new Date(),
        yearRange: ""+minYear+":"+maxYear,
        onSelect: function (dateCalendar,base) {

            //Current date in format "yy dd M"
            var calendarCurrentDate = formatDate(new Date());

            var dayMonth = base.input.parent().parent().find('.calendar-day-month-input').first();

            if (dayMonth.val() != "") {
                dayMonth.val(dateCalendar.substring(5));
                base.input.val(dateCalendar);
                base.input.datepicker( "option", "defaultDate",new Date(dateCalendar));
            }
            else if (dayMonth.val() == "") {
                dayMonth.val(calendarCurrentDate.substring(5));
                base.input.val(calendarCurrentDate);
                base.input.datepicker( "option", "defaultDate",new Date(calendarCurrentDate));
            }

            updateSlider();
        },
    }

    //Helper functions
    var formatDate = function (date){
            var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
            return date.getFullYear() + ' ' + (date.getDay() < 10 ? '0' + date.getDay() : '' + date.getDay()) + ' ' + months[date.getMonth()]
    }
    var updateSlider = function () {
        $('#slider-range').slider("values", 0,  $( "#start-year" ).datepicker('getDate').getFullYear());
        $('#slider-range').slider("values", 1,  $( "#end-year" ).datepicker('getDate').getFullYear());
    };

    //Setup slider
    $("#slider-range").slider({
        range: true,
        min: minYear,
        max: maxYear,
        values: [minYear, maxYear],

        //Update datepickers visually as the user drags the slider
        slide: function (event, ui) {
            var startDate = $( "#start-year" ).datepicker('getDate');
            var endDate = $( "#end-year" ).datepicker('getDate');
            startDate.setFullYear(ui.values[ 0 ]);
            endDate.setFullYear(ui.values[ 1 ]);
            $( "#start-year" ).datepicker('setDate',startDate);
            $( "#end-year" ).datepicker('setDate',endDate);
        },

        //Update the datepickers after the user drops the slider
        stop: function (event,ui) {

            var startDatepicker = $("#start-year");
            var endDatePicker = $("#end-year");

            var startDate = startDatepicker.datepicker('getDate')
            var endDate = endDatePicker.datepicker('getDate')

            startDate.setFullYear(ui.values[0]);
            endDate.setFullYear(ui.values[1]);

            var oldStartOptions = startDatepicker.datepicker('option', 'all');
            var oldEndOptions = endDatePicker.datepicker('option', 'all');

            startDatepicker.datepicker('destroy').datepicker($.extend(oldStartOptions, {
                maxDate: endDate,
                defaultDate: startDate
            }));

            endDatePicker.datepicker('destroy').datepicker($.extend(oldEndOptions, {
                minDate: startDate,
                defaultDate: endDate
            }));
        }
    });
    $("#start-year").val($("#slider-range").slider("values", 0));
    $("#end-year").val($("#slider-range").slider("values", 1));


    //Create left datepicker
    $("#calendar-day-month-start").val(formatDate(defaultDatepickerOptions.minDate).substring(5));
    $(".call-datepicker-start-year").datepicker({
        ...defaultDatepickerOptions,
        defaultDate: defaultDatepickerOptions.minDate,
        onSelect: function (dateCalendar,base) {
            var otherDatepicker = $( ".call-datepicker-end-year" );

            defaultDatepickerOptions.onSelect(dateCalendar,base);

            var prevOptions = otherDatepicker.datepicker('option', 'all');
            otherDatepicker.datepicker('destroy').datepicker($.extend(prevOptions, {
                minDate: dateCalendar
            }));
        }
    });
    
    //Create right datepicker
    $("#calendar-day-month-end").val(formatDate(defaultDatepickerOptions.maxDate).substring(5));
    $(".call-datepicker-end-year").datepicker({
        ...defaultDatepickerOptions,
        defaultDate: defaultDatepickerOptions.maxDate,
        onSelect: function (dateCalendar,base) {
            var otherDatepicker = $( ".call-datepicker-start-year" );

            defaultDatepickerOptions.onSelect(dateCalendar,base);
            var prevOptions = otherDatepicker.datepicker('option', 'all');
            otherDatepicker.datepicker('destroy').datepicker($.extend(prevOptions, {
                maxDate: dateCalendar
            }));
        }
    });

});

