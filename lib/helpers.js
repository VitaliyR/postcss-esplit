var path = require('path');

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
    },

    /**
     * Retrieve filename for style by filling template from options
     *
     * @param {String} filename
     * @param {Object} [destination] object returned by path.parse
     * @param {number} index
     * @returns {string|null}
     */
    getFileName: function (filename, destination, index) {
        if (!destination) return null;

        filename = filename
            .replace(/%i%/gm, index)
            .replace(/%original%/gm, destination.name);

        return destination.dir + path.sep + filename + destination.ext;
    },

    /**
     * Finds obj in array of arrays where 0 el is obj-key
     *
     * @param {Object} obj
     * @param {Array.<Array.<Rule>>}arr
     * @returns {*}
     */
    find: function (obj, arr) {
        for (var i = 0, maxI = arr.length; i < maxI; i++) {
            if (arr[i][0] === obj) {
                return arr[i][1];
            }
        }
    },

    /**
     * Returns parents for the node
     *
     * @param {Node} node
     * @returns {Array.<Node>}
     */
    parents: function (node) {
        var parents = [];
        var parent = node.parent;

        while (parent && parent.type !== 'root') {
            parents.push(parent);
            parent = parent.parent;
        }

        return parents;
    }

};
