/* eslint max-len: [2, 160] */

var postcss = require('postcss');
var chai = require('chai');
var expect = chai.expect;
var AssertionError = chai.AssertionError;

var plugin = require('../');


var testOwnSuite = function (input, opts, done, cb) {
    return postcss([plugin(opts)]).process(input).then(function (result) {
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
        expect(result.css).to.eql(output);
        expect(result.warnings()).to.be.empty;

        if (splittedFiles.length) {
            expect(result.roots.length).to.be.eql(splittedFiles.length);
            result.roots.forEach(function (root, index) {
                expect(root.css).to.eql(splittedFiles[index]);
            });
        }
    });

    testOwnSuite.apply(this, args);
};


describe('postcss-split', function () {

    it('There are no splitted files even if writeFiles is true', function (done) {
        var source = 'a{}';

        testOwnSuite(source, { writeFiles: false }, done, function (result) {
            expect(result.css).to.eql(source);
            expect(result.warnings()).to.be.empty;
            expect(result.roots).to.be.empty;
        });
    });

    it('Fail if there are splitted files and writeFiles is true', function (done) {
        var source = 'a{} b{}';
        var res = 'a{}';

        testOwnSuite(source, { maxSelectors: 1 }, done, function (result) {
            expect(result.css).to.be.equals(res);
            expect(result.warnings()).to.be.not.empty;
            expect(result.roots).to.be.not.empty;
        });
    });

    it('Not split file with less count of selectors than maxSelectors', function (done) {
        test('a{ }', 'a{ }', [], { writeFiles: false }, done);
    });

    it('Split file correctly without warnings by providing maxSelectors', function (done) {
        test('a{} b{}', 'a{}', ['b {}'], { maxSelectors: 1, writeFiles: false }, done);
    });

    it('Split files to 3 correctly without warning by providing maxSelectors', function (done) {
        test('a{} b{} c{}', 'a{}', ['c {}', 'b {}'], { maxSelectors: 1, writeFiles: false }, done);
    });

});
