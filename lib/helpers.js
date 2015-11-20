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
                if (mergeObj.hasOwnProperty(key)) {
                    obj[key] = mergeObj[key];
                }
            }
        }

        return obj;
    },

    /**
     * Merge into first passed argument object parameters from other objects
     * @returns {Object} first argument
     */
    defaults: function () {
        var obj = arguments[0];

        for (var i = 1; i < arguments.length; i++) {
            var mergeObj = arguments[i];
            for (var key in mergeObj) {
                if (mergeObj.hasOwnProperty(key) && typeof obj[key] === 'undefined') {
                    obj[key] = mergeObj[key];
                }
            }
        }

        return obj;
    }

};
