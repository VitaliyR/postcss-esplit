var postcss = require('postcss');
var fs = require('fs');
var path = require('path');
var chalk = require('chalk');
var mkdirp = require('mkdirp');
var helpers = require('./lib/helpers');

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
 * @param {boolean} [removeCurrentNode=false]
 * @returns {Root}
 */
var moveNodesStartingFrom =
    function (startingNode, destination, removeCurrentNode) {
        if (!startingNode.parent) { // root-node
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

        removeCurrentNode && startingNode.remove();

        while (nextNode) {
            var currentNode = nextNode;
            nextNode = nextNode.next();

            if (currentNode.type === 'atrule' && !currentNode.nodes.length) {
                continue;
            }

            currentNode.moveTo(parent);
        }

        return moveNodesStartingFrom(
            startingNodeParent,
            parent,
            startingNodeParent.nodes.length === 0
        );
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
 * fs.writeFile which returns Promise
 *
 * @param {string} [dest] destination path
 * @param {string} [src] contents of the file
 * @parm {boolean} [mkDir=false] recursive make dir to dest
 * @returns {Promise}
 */
var writePromise = function (dest, src, mkDir) {
    return new Promise(function (res, rej) {
        var writeFileHandler = function () {
            fs.writeFile(dest, src, function (err) {
                err ? rej(err) : res();
            });
        };

        if (mkDir) {
            mkdirp(path.dirname(dest), function (errMkdir) {
                errMkdir ? rej(errMkdir) : writeFileHandler();
            });
        } else {
            writeFileHandler();
        }
    });
};


/**
 * Export plugin
 */
module.exports = postcss.plugin('postcss-split', function (opts) {
    opts = opts || {};

    // merging default settings
    helpers.extend(opts, defaults);

    options = opts;

    return function (css, result) {
        var processor = postcss().use(result.processor);
        processor.plugins = processor.plugins.filter(function (plugin) {
            return plugin.postcssPlugin !== 'postcss-split';
        });

        roots = [];
        selectors = 0;

        processTree(css);

        result.root = css;

        // for that old node.js
        var destination = result.opts.to ?
            (path.parse ? path.parse : require('path-parse'))(result.opts.to) :
            null;

        var filesForWrite = [];
        var rootsProcessing = [];

        roots.forEach(function (root, index) {
            var fileName = getFileName(destination, index);

            rootsProcessing.push(
                processor.process(root, { to: fileName }).then(
                    function (rootResult) {
                        roots[index] = rootResult;

                        if (!result.opts.to) return;

                        filesForWrite.push(
                            writePromise(
                                rootResult.opts.to, rootResult.css, true
                            )
                        );

                        if (options.writeSourceMaps && rootResult.map) {
                            filesForWrite.push(
                                writePromise(
                                    rootResult.opts.to + '.map',
                                    rootResult.map.toString(),
                                    true
                                )
                            );
                        }
                    })
            );

        }, this);

        if (roots.length) {
            log('Divided into %s style files %s',
                roots.length,
                result.opts.to ? 'from ' + result.opts.to : ''
            );
        } else {
            log('Found %s selectors, skipping %s',
                selectors,
                result.opts.to || ''
            );
        }

        return new Promise(function (pluginDone, pluginFailed) {
            Promise.all(rootsProcessing).then(function () {

                result.roots = roots;

                if (options.writeImport) {
                    for (var i = roots.length - 1; i >= 0; i--) {
                        var importNode = postcss.atRule({
                            name: 'import',
                            params: 'url(' + path.basename(roots[i].opts.to) + ')'
                        });
                        css.prepend(importNode);
                    }
                }

                if (options.writeFiles && !result.opts.to) {
                    result.warn(
                        'Destination is not provided, ' +
                        'splitted css files would not be written'
                    );
                    return pluginDone();
                }

                Promise.all(filesForWrite).then(pluginDone).catch(pluginFailed);
            });
        });
    };
});
