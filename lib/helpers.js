module.exports = {

    /**
     * Extends first passed argument object with objects from other arguments
     * @returns {Object} first argument
     */
    extend: function () {
        var obj = arguments[0];

        for (var i = 1; i < arguments.length; i++) {
            var mergeObj = arguments[i];
            for (var key in mergeObj) {
                if (typeof obj[key] === 'undefined') {
                    obj[key] = mergeObj[key];
                }
            }
        }

        return obj;
    }

};
