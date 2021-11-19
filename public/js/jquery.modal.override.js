if ($ && $.modal) {
    $.modal.prototype.open = function () {
        var m = this;
        this.block();
        this.anchor.blur();
        if (this.options.doFade) {
            setTimeout(function () {
                m.show();
            }, this.options.fadeDuration * this.options.fadeDelay);
        } else {
            this.show();
        }
        $(document).off('keydown.modal').on('keydown.modal', function (event) {
            var current = $.modal.getCurrent();
            if (event.which === 27 && current.options.escapeClose) current.close();
        });
        if (this.options.clickClose) {
            if (!this.$blocker.properties) {
                this.$blocker.properties = {};
            }
            this.$blocker.properties.mousedown = false;
            this.$blocker.off('mousedown').on('mousedown', function (e) {
                if (e.target === this){
                    m.$blocker.properties.mousedown = true;
                }
            });
            this.$blocker.off('mouseup').on('mouseup', function (e) {
                if (e.target === this && m.$blocker.properties.mousedown) {
                    $.modal.close();
                } else {
                    m.$blocker.properties.mousedown = false;
                }

            });
        }

    }
}

