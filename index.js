var postcss = require('postcss');
var fs = require('fs');
var path = require('path');
var chalk = require('chalk');
var mkdirp = require('mkdirp');
var helpers = require('./lib/helpers');
var pkg = require('./package.json');

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
 * Moves rules from start to, including, end nodes from root to new postcss.root
 * @param {Rule} startNode
 * @param {Rule} endNode
 * @param {Root} root
 * @returns {Root}
 */
var moveNodes = function (startNode, endNode, root) {
    var newRoot = postcss.root();
    var foundStart;
    var parentsRelations = [
        [root, newRoot]
    ];

    root.walkRules(function (node) {
        if (node === startNode) foundStart = true;

        if (foundStart) {
            var newParent = helpers.find(node.parent, parentsRelations);
            if (!newParent) {
                var nodeParent = node.parent;
                var copyParent, prevCopyParent;

                // copy parents
                while (nodeParent.type !== 'root') {
                    copyParent = nodeParent.clone({
                        nodes: [],
                        raws: nodeParent.raws
                    });
                    parentsRelations.push([nodeParent, copyParent]);

                    prevCopyParent && copyParent.append(prevCopyParent);
                    !newParent && (newParent = copyParent);

                    prevCopyParent = copyParent;
                    nodeParent = nodeParent.parent;
                }

                newRoot.append(copyParent);
            }

            var nodeParents = helpers.parents(node);

            node.moveTo(newParent); // todo try to clone before/after etc?

            nodeParents.forEach(function (parent) {
                !parent.nodes.length && parent.remove();
            });
        }

        if (node === endNode) {
            return false;
        }
    });

    return newRoot;
};

/**
 * Splits rule selectors by provided position
 *
 * @param {Rule} node
 * @param {Number} position
 * @returns {undefined|Rule}
 */
var splitRule = function (node, position) {
    if (!position) return null;

    var newNode = node.clone({
        selector: node.selectors.slice(position).join(',')
    });
    node.selector = node.selectors.slice(0, position).join(',');

    node.parent.insertAfter(node, newNode);

    return node;
};

/**
 * Walking by css nodes and if passed selectors count are below
 * the maxSelectors option move them to another style file. Recursive.
 *
 * @param {Root} css
 */
var processTree = function (css) {
    var startingNode, endNode, prevNode;

    css.walkRules(function (node) {
        !startingNode && (startingNode = node);

        if ((selectors += node.selectors.length) > options.maxSelectors) {
            var selInSource = node.selectors.length - (selectors - options.maxSelectors);
            endNode = splitRule(node, selInSource) || prevNode;

            var newFile = moveNodes(startingNode, endNode, css);
            roots.push(newFile);

            selectors = 0;
            processTree(css);

            return false;
        }

        prevNode = node;
    });
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
        plugin: pkg.name,
        text: msg
    });

    if (options.quiet) return;

    var args = [
        chalk.green('>>') + ' ' + pkg.name + ': ' + msg
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
        var fileName = helpers.getFileName(options.fileName, destination, index);

        processor.process(root, {
            from: result.opts.from,
            to: fileName,
            map: result.opts.map
        }).then(
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
module.exports = postcss.plugin(pkg.name, function (opts) {
    opts = opts || {};

    // merging default settings
    helpers.defaults(opts, defaults);

    options = opts;

    return function (css, result) {
        messages = [];

        // preventing multiple instances in current processor
        var pluginMatch;

        result.processor.plugins = result.processor.plugins.filter(function (plugin) {
            var splitPlugin = plugin.postcssPlugin === pkg.name;

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
