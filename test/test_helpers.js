var postcss = require('postcss');
var chai = require('chai');
var expect = chai.expect;
var AssertionError = chai.AssertionError;
var plugin = require('../');

var fs = require('fs');
var path = require('path');

var spaceRegexp = / |\n/gmi;
var testPath = 'test/output/test.css';
var testDir = 'test/output';

/**
 * Clears passed css from spaces and line breaks
 * @param {string} css
 * @returns {string}
 */
var clearCss = function (css) {
    return css.replace(spaceRegexp, '');
};

var testOwnSuite = function (input, opts, done, cb, processOpts) {
    return postcss([plugin(opts)]).process(input, processOpts).then(function (result) {
        try {
            cb(result);
            done();
        } catch (e) {
            done(e);
        }
    }).catch(function (error) {
        done(
            error.actual instanceof Array ?
                new AssertionError(error.actual[0].text, {}) :
                error
        );
    });
};

var test = function (input, output, splittedFiles, opts, done) {
    var args = [input, opts, done];

    args.push(function (result) {
        expect(clearCss(result.css)).to.eql(clearCss(output));
        expect(result.warnings()).to.be.empty;

        if (splittedFiles.length) {
            expect(result.roots.length).to.be.eql(splittedFiles.length);
            result.roots.forEach(function (root, index) {
                expect(clearCss(root.css)).to.eql(clearCss(splittedFiles[index]));
            });
        }
    });

    testOwnSuite.apply(this, args);
};

var clearTestDir = function () {
    if (fs.existsSync(testDir)) {
        fs.readdirSync(testDir).forEach(function (file) {
            fs.unlink(testDir + path.sep + file);
        });
    }
};

/**
 * Exports
 */
module.exports = {
    testPath: testPath,
    testDir: testDir,

    clearCss: clearCss,
    clearTestDir: clearTestDir,
    test: test,
    testOwnSuite: testOwnSuite
};
