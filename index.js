var fs = require('fs');
var path = require('path');
var chalk = require('chalk');
var mkdirp = require('mkdirp');

var postcss = require('postcss');
var MapGenerator = require('postcss/lib/map-generator');
var Result = require('postcss/lib/result');

var pkg = require('./package.json');
var helpers = require('./lib/helpers');

/**
 * Plugin default options
 * @const
 */
var defaults = {
    maxSelectors: 4000,
    fileName: '%original%-%i%',
    fileNameStartIndex: 0,
    writeFiles: true,
    writeSourceMaps: true,
    writeImport: true,
    quiet: false
};

/**
 * At-Rules, contents should not be separated between roots
 * @type {Array.<String>}
 */
var unbreakableAtRules = ['keyframes'];

var roots;
var treeSelectors;
var selectors;
var options;
var messages;

/**
 * Moves rules from start to, including, end nodes from root to new postcss.root
 * @param {Node} startNode
 * @param {Node} endNode
 * @param {Root} root
 * @returns {Root}
 */
var moveNodes = function (startNode, endNode, root) {
    var newRoot = postcss.root({ raws: root.raws });
    var foundStart;
    var parentsRelations = [
        [root, newRoot]
    ];

    root.walk(function (node) {
        if (node.type !== 'decl' && node.type !== 'rule') return true;
        if (node.type === 'decl' && node.parent.type !== 'atrule') return true;
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

            // move node, remove its parents if it was the only one node here
            var nodeParents = helpers.parents(node);

            node.remove();
            newParent.append(node);

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
 * Checks if passed node is At-Rule and it exists in unbreakable at-rules list
 * @param {Node} node
 * @returns {boolean}
 */
var isUnbreakableAtRule = function (node) {
    return node.type === 'atrule' && unbreakableAtRules.indexOf(node.name) !== -1;
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

    css.walk(function (node) {
        if (isUnbreakableAtRule(node)) {
            prevNode = node.last;
            treeSelectors += 1;
            selectors += 1;
            return true;
        }
        if (isUnbreakableAtRule(node.parent)) {
            return true;
        }
        if (!node.selector) return true;

        !startingNode && (startingNode = node);

        if ((treeSelectors += node.selectors.length) > options.maxSelectors) {
            var selInSource = node.selectors.length - (treeSelectors - options.maxSelectors);
            endNode = splitRule(node, selInSource) || prevNode;

            selectors += selInSource ? endNode.selectors.length : 0;

            var newFile = moveNodes(startingNode, endNode, css);
            roots.push(newFile);

            treeSelectors = 0;
            processTree(css);

            return false;
        } else {
            selectors += node.selectors.length;
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
 * @param {boolean} [mkDir=false] recursive make dir to dest
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
        var fileNameStartIndex = Number(options.fileNameStartIndex);
        fileNameStartIndex = isNaN(fileNameStartIndex) ? 0 : fileNameStartIndex;
        var fileIndex = index + fileNameStartIndex;
        var fileName = helpers.getFileName(options.fileName, destination, fileIndex);

        var rootOpts = helpers.extend({}, result.opts, { to: fileName });
        var rootResult = new Result(processor, root, rootOpts);
        var rootData = new MapGenerator(postcss.stringify, root, result.opts).generate();
        rootResult.css = rootData[0];
        rootResult.map = rootData[1];

        if (!rootResult.opts.to) {
            if (options.writeFiles) {
                result.warn(
                    'Destination is not provided, ' +
                    'splitted css files would not be written'
                );
            }

            return resolve(rootResult);
        }

        if (!options.writeFiles) return resolve(rootResult);

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

        // ensure plugin running in the end
        if (result.processor.plugins[result.processor.plugins.length - 1] !== result.lastPlugin) {
            // remove plugin duplicates
            result.processor.plugins = result.processor.plugins.filter(function (plugin) {
                return plugin.postcssPlugin === pkg.name ? plugin === result.lastPlugin : true;
            });

            // adding it to the end of the plugins array
            result.processor.plugins.push(result.lastPlugin);

            return false;
        }

        roots = [];
        treeSelectors = selectors = 0;

        processTree(css);

        result.root = css;

        // for that old node.js
        var destination = result.opts.to ?
            (path.parse ? path.parse : require('path-parse'))(result.opts.to) :
            null;

        var rootsProcessing = [];

        roots.forEach(function (root, index) {
            rootsProcessing.push(
                processRoot(result.processor, root, index, destination, result)
            );
        }, this);

        if (roots.length) {
            log('Divided into %s style files %s (Found %s selectors)',
                roots.length,
                result.opts.to ? 'from ' + result.opts.to : '',
                selectors
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
                    // find charset node
                    var charsetRule;
                    css.walkAtRules('charset', function (rule) {
                        if (!charsetRule) {
                            charsetRule = rule;
                            return false;
                        }
                    });

                    if (charsetRule) {
                        charsetRule.remove();
                        css.prepend(charsetRule);
                    }

                    var destinationError;

                    for (var i = processedRoots.length - 1; i >= 0; i--) {
                        if (processedRoots[i].opts.to) {
                            var importNode = postcss.atRule({
                                name: 'import',
                                params: 'url(' + path.basename(processedRoots[i].opts.to) + ')'
                            });
                            charsetRule ?
                                css.insertAfter(charsetRule, importNode) :
                                css.prepend(importNode);
                        } else {
                            destinationError = true;
                        }
                    }

                    if (destinationError) {
                        result.warn(
                            'Destination is not provided, ' +
                            '@import directive will be not written'
                        );
                    }
                }

                result.messages = result.messages.concat(messages);
                pluginDone();

            }).catch(pluginFailed);
        });
    };
});
