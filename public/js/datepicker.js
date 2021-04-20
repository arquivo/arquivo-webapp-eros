$(function () {
    //Make sure the targets exist
    if ($('#search-tools-date-slider').length) {

        //Constants
        const minDate = new Date(1991, 7, 6);
        const maxDate = new Date();
        const minYear = minDate.getFullYear();
        const maxYear = maxDate.getFullYear();
        const modal = $('#modal');
        const inputMask = { regex: "[0-3][0-9]\/[0-1][0-9]\/[1-2][0-9][0-9][0-9]", insertMode: false };
        var modalDatepickerContent = null;

        const isMobile = function() {return( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) || (window.matchMedia("(max-width: 767px)").matches)};

        //load modal datepicker template into local variable
        $.ajax({
            url: '/fragments/modal-datepicker?l='+lang,
            success: function (data) {
                modalDatepickerContent = data
            }
        });

        //converts yyyymmdd into Date object
        let stringToDate = function (dateString) {
            return new Date(dateString.slice(0,4),dateString.slice(4,6)-1,dateString.slice(6,8));
        }

        //Updates the sliders' positions
        let updateSlider = function () {
            $('#slider-range').slider("values", 0, stringToDate($("#start-date").val()).getFullYear());
            $('#slider-range').slider("values", 1, stringToDate($("#end-date").val()).getFullYear());
        };

        //Updates the dates and the slider
        const updateDateSlider = function(newDate,type){
            $("#" + type + "-date").val(newDate.toLocaleDateString('en-CA').split('-').join(''));
            $("#" + type + "-year").val(newDate.getFullYear());
            $("#" + type + "-day-month").val(newDate.getDate() + ' ' + $.datepicker.regional[lang].monthNamesShort[newDate.getMonth()]); //lang is global
            updateSlider();
        }
        //Sets up the logic in the modal
        let setupModalDatepicker = function (type) {
            const outInputId = type + '-date';
            const modalInputId = 'modal-datepicker-input';
            const modalInput = $('#' + modalInputId);

            $('#modal-datepicker-title').text(translations['modal-datepicker']['header'][type][lang]);

            const submitDate = function (newDate) {
                updateDateSlider(newDate,type)
                $('#modal-datepicker-datepicker').datepicker('setDate', newDate);
            }

            //Enter clicks on "ok" button
            modalInput.on('keyup', function (e) {
                if (e.keyCode === 13) {
                    $('#modal-datepicker-confirm-button').click()
                }
            });

            //Mask input
            modalInput.inputmask(inputMask);
            // default input value
            modalInput.val((() => {
                const outDateString = $('#' + outInputId).val()
                return (outDateString.slice(6,8)+'/'+outDateString.slice(4,6)+'/'+outDateString.slice(0,4))
            })());
            // on change input
            modalInput.change(function () {
                const dateInputValue = $(this).val();
                // prevent change the date when the user didn't finish inserting a full date on keyboard
                if (dateInputValue.replace('_', '').length == 10) {
                    const newDate = stringToDate(dateInputValue);
                    // update datepicker with newinput value
                    submitDate(newDate);
                }
            });

            $('#modal-datepicker-datepicker').datepicker({
                ...$.datepicker.regional[ lang ],
                monthNamesShort: $.datepicker.regional[ lang ].monthNames, //Display full month names
                defaultDate: stringToDate($('#' + outInputId).val()), // Set the date to highlight on first opening if the field is blank.
                inline: true,
                altField: '#' + modalInputId,
                dateFormat: "dd/mm/yy",
                changeMonth: true, // Whether the month should be rendered as a dropdown instead of text.
                changeYear: true, // Whether the year should be rendered as a dropdown instead of text
                yearRange: minYear + ":" + maxYear, // The range of years displayed in the year drop-down - minYear and maxYear are a global javascript variables
                minDate: type === 'start' ? minDate : stringToDate($('#start-date').val()),
                maxDate: type === 'end' ? maxDate : stringToDate($('#end-date').val()),
                // monthNamesShort: $.datepicker.regional[language].monthNames,
                onChangeMonthYear: function (y, m, i) {
                    var d = i.selectedDay;

                    // to prevent the problem when changing from a month with 31 days to a other month with <31 days
                    // the calendar were going to the first or second day of the next month
                    function getDaysInMonth(m, y) {
                        return m === 2 ? y & 3 || !(y % 25) && y & 15 ? 28 : 29 : 30 + (m + (m >> 3) & 1);
                    }
                    const minDay = Math.min(getDaysInMonth(m, y), d);
                    console.log(new Date(y, m - 1, minDay));
                    submitDate(new Date(y, m - 1, minDay));
                },
                onSelect: function (dateText, inst) {
                    const newDateText = dateText.split('/').reverse().join('');
                    const newDate = stringToDate(newDateText);
                    submitDate(newDate);
                },
            });

            //OK button functionality
            $('#modal-datepicker-confirm-button').click(function () {
                const dateInputValue = $('#modal-datepicker-input').val();
                if (dateInputValue.replace('_', '').length == 10) {
                    const newDateText = dateInputValue.split('/').reverse().join('');
                    const newDate = stringToDate(newDateText);
                    // update datepicker with newinput value
                    submitDate(newDate);
                }
                $.modal.close();
            });
        }

        //Setup slider
        $("#slider-range").slider({
            range: true,
            min: minYear,
            max: maxYear,
            values: [minYear, maxYear],

            //Update datepickers visually as the user drags the slider
            slide: function (event, ui) {
                $("#start-year").val(ui.values[0]);
                $("#end-year").val(ui.values[1]);
            },

            //Update the datepickers after the user drops the slider
            stop: function (event, ui) {
                let startDate = $('#start-date').val();
                let endDate = $('#end-date').val();

                $('#start-date').val(ui.values[0]+startDate.slice(4));
                $('#end-date').val(ui.values[1]+endDate.slice(4));

            }
        });

        //Create datepickers
        ['start', 'end'].forEach(type => {
            $(".call-datepicker-" + type + "-year").click(function () {
                if (isMobile()){
                    const selectedDate = stringToDate($('#'+type+'-date').val());
                    $('#'+type+'-date').AnyPicker(
                        {
                            mode: "datetime",
                            dateTimeFormat: "dd MMM yyyy",
                            inputDateTimeFormat: "yyyyMMdd",
                            selectedDate: selectedDate,
                            minValue: type === 'start' ? minDate : stringToDate($('#start-date').val()),
                            maxValue: type === 'end' ? maxDate : stringToDate($('#end-date').val()),
                            theme: "iOS",
                            lang: lang,
                            onInit: function()
                            {
                                this.showOrHidePicker($('#'+type+'-date').val());
                            },
                            onChange: function(component_i,row_i,val){
                                updateDateSlider(val.date,type);
                            },
                            buttonClicked: function(buttonType){
                                if(buttonType == 'cancel'){
                                    updateDateSlider(selectedDate,type);
                                }
                            }
                        });
                } else {
                    modal.html(modalDatepickerContent);
                    setupModalDatepicker(type);
                    modal.modal();
                    $('#modal-datepicker-input').select();
                }
            });
        });

        $('#submit-search').submit(function () {
            const startDate = stringToDate($('#start-date'));
            const endDate = stringToDate($('#end-date'));
            if (startDate > endDate) {
                modal.html('<h4 class="modalTitle"><i class="fa" aria-hidden="true"></i> ' + 'ERRO' + '</h4>' + //FIX
                    '<div class="row"><a href="#close" rel="modal:close" class="col-xs-6 text-center leftAnchor modalOptions">OK</a></div>'
                );
                return false;
            }
            //Make sure pressing enter does not submit the search while modal is active
            if ($('.jquery-modal.blocker').length) {
                return false;
            }
            return true;
        });

        //Make sure slider is properly set
        updateSlider();
    }
});

