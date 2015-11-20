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
var messages;

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
        var parent = startingNodeParent.clone({
            nodes: [],
            raws: startingNodeParent.raws
        });

        var nextNode = startingNode.next();

        if (destination) {
            destination.moveTo(parent);
        } else {
            startingNode.moveTo(parent);
        }

        removeCurrentNode && startingNode.remove();

        while (nextNode) {
            var currentNode = nextNode;
            var currentNodeRaws = helpers.extend({}, nextNode.raws);

            nextNode = nextNode.next();

            if (currentNode.type === 'atrule' && !currentNode.nodes.length) {
                continue;
            }

            currentNode.moveTo(parent);
            currentNode.raws = currentNodeRaws;
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
 * Log message to PostCSS
 * Arguments are used for filling template
 *
 * @param {string} msg
 */
var log = function (msg/* ...args */) {
    Array.prototype.slice.call(arguments, 1, arguments.length).forEach(function (data) {
        msg = msg.replace(/%s/, data);
    }, this);

    messages.push({
        type: 'info',
        plugin: 'postcss-esplit',
        text: msg
    });

    if (options.quiet) return;

    var args = [
        chalk.green('>>') + ' postcss-esplit: ' + msg
    ];

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

var processRoot = function (processor, root, index, destination, result) {
    return new Promise(function (resolve, reject) {
        var filesForWrite = [];
        var fileName = getFileName(destination, index);

        processor.process(root, { from: result.opts.from, to: fileName }).then(
            function (rootResult) {

                if (!rootResult.opts.to) {
                    if (options.writeFiles) {
                        result.warn(
                            'Destination is not provided, ' +
                            'splitted css files would not be written'
                        );
                    }

                    return resolve(rootResult);
                }

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

                Promise.all(filesForWrite).then(function () {
                    resolve(rootResult);
                }).catch(reject);
            }).catch(reject);
    });
};


/**
 * Export plugin
 */
module.exports = postcss.plugin('postcss-split', function (opts) {
    opts = opts || {};

    // merging default settings
    helpers.defaults(opts, defaults);

    options = opts;


    return function (css, result) {
        messages = [];

        // preventing multiple instances in current processor
        var pluginMatch;

        result.processor.plugins = result.processor.plugins.filter(function (plugin) {
            var splitPlugin = plugin.postcssPlugin === 'postcss-split';

            if (splitPlugin && !pluginMatch) {
                pluginMatch = true;
                return true;
            }

            return !splitPlugin;
        });

        // processing other roots only with processors which are not already processed source
        var processor = postcss().use(result.processor);
        processor.plugins = processor.plugins.slice(
            processor.plugins.indexOf(result.lastPlugin) + 1
        );

        roots = [];
        selectors = 0;

        processTree(css);

        result.root = css;

        // for that old node.js
        var destination = result.opts.to ?
            (path.parse ? path.parse : require('path-parse'))(result.opts.to) :
            null;

        var rootsProcessing = [];

        roots.forEach(function (root, index) {
            rootsProcessing.push(
                processRoot(processor, root, index, destination, result)
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
            Promise.all(rootsProcessing).then(function (processedRoots) {

                result.roots = processedRoots;

                if (options.writeImport && processedRoots.length) {
                    for (var i = processedRoots.length - 1; i >= 0; i--) {
                        var importNode = postcss.atRule({
                            name: 'import',
                            params: 'url(' + path.basename(processedRoots[i].opts.to) + ')'
                        });
                        css.prepend(importNode);
                    }
                }

                result.messages = result.messages.concat(messages);
                pluginDone();

            }).catch(pluginFailed);
        });
    };
});
