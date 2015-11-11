var postcss = require('postcss');
var fs = require('fs');
var path = require('path');
var chalk = require('chalk');

var defaults = {
    maxSelectors: 4000,
    fileName: '%original%-%i%',
    writeFiles: true,
    writeSourceMaps: true,
    writeImport: true,
    quiet: false
};

var roots;
var selectors;
var options;

/**
 * Moving nodes and siblings to cloned parent node.
 * Recursive until root.
 *
 * @param {Node} startingNode
 * @param {Node} destination
 * @returns {Root}
 */
var moveNodesStartingFrom = function (startingNode, destination) {
    if (!startingNode.parent) {
        return destination;
    }

    var startingNodeParent = startingNode.parent;
    var parent = startingNodeParent.clone({ nodes: [] });
    var nextNode = startingNode.next();

    if (destination) {
        destination.moveTo(parent);
    } else {
        startingNode.moveTo(parent);
    }

    while (nextNode) {
        var currentNode = nextNode;
        nextNode = nextNode.next();
        currentNode.moveTo(parent);
    }

    return moveNodesStartingFrom(startingNodeParent, parent);
};

/**
 * Walking by css nodes and if passed selectors count are below
 * the maxSelectors option move them to another style file. Recursive.
 *
 * @param {Root} css
 */
var processTree = function (css) {
    css.walk(function (node) {
        if (!node.selectors) return true;

        if ((selectors += node.selectors.length) > options.maxSelectors) {
            var newFile = moveNodesStartingFrom(node);
            roots.push(newFile);

            selectors = 0;
            processTree(newFile);

            return false;
        }
    });
};

/**
 * Retreive filename for style by filling template from options
 *
 * @param {Object} destination
 * @param {number} index
 * @returns {string|null}
 */
var getFileName = function (destination, index) {
    if (!destination) return null;

    var fileName = options.fileName
        .replace(/%i%/gm, index)
        .replace(/%original%/gm, destination.name);

    return destination.dir + path.sep + fileName + destination.ext;
};

/**
 * Log message to console with >>
 * Arguments are passed to console.log function
 *
 * @param {string} msg
 */
var log = function (msg/* ...args */) {
    if (options.quiet) return;

    var args = [
        chalk.green('>>') + ' ' + msg
    ].concat(Array.prototype.slice.call(arguments, 1, arguments.length));

    console.log.apply(this, args);
};


/**
 * Export plugin
 */
module.exports = postcss.plugin('postcss-split', function (opts) {
    opts = opts || {};

    // merging default settings
    for (var key in defaults) {
        if (typeof opts[key] === 'undefined') {
            opts[key] = defaults[key];
        }
    }

    options = opts;

    return function (css, result) {
        roots = [];
        selectors = 0;

        processTree(css);

        result.root = css;

        // for that old node
        var destination = result.opts.to ?
            (path.parse ? path.parse : require('path-parse'))(result.opts.to) :
            null;

        var filesForWrite = [];

        roots = roots.reverse().map(function (root, index) {
            var fileName = getFileName(destination, index);

            var file = root.toResult(!fileName ? undefined : {
                to: fileName,
                map: {
                    sourcesContent: false,
                    inline: false,
                    prev: true
                }
            });

            if (options.writeImport && fileName) {
                var importNode = postcss.atRule({
                    name: 'import',
                    params: 'url(' + path.basename(fileName) + ')'
                });
                css.prepend(importNode);
            }

            if (!options.writeFiles) return file;

            filesForWrite.push({
                dest: file.opts.to,
                src: file.css
            });

            if (options.writeSourceMaps && file.map) {
                filesForWrite.push({
                    dest: fileName + '.map',
                    src: file.map.toString()
                });
            }

            return file;
        });

        result.roots = roots;

        if (roots.length) {
            log('Divided into %s style files %s',
                roots.length,
                result.opts.to ? 'from ' + result.opts.to : ''
            );
        } else {
            log('Found %s selectors, skipping %s',
                selectors,
                result.opts.to ? 'from ' + result.opts.to : ''
            );
        }

        if (options.writeFiles && !result.opts.to) {
            return result.warn(
                'Destination is not provided, ' +
                'splitted css files would not be written'
            );
        }

        filesForWrite = filesForWrite.map(function (file) {
            return new Promise(function (resolve, reject) {
                fs.writeFile(file.dest, file.src, function (err) {
                    err ? reject(err) : resolve();
                });
            });
        });

        return Promise.all(filesForWrite);
    };
});
