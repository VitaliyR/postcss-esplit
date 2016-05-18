/* eslint max-len: [2, 160] */

var chai = require('chai');
var expect = chai.expect;

var fs = require('fs');
var path = require('path');
var pkg = require('../package.json');

var testHelpers = require('./test_helpers');

var test = testHelpers.test;
var testOwnSuite = testHelpers.testOwnSuite;

/**
 * For temporary outputting css files
 * @const
 * @type {string}
 */

describe(pkg.name, function () {

    it('There are no splitted files even if writeFiles is true', function (done) {
        var source = 'a{}';

        testOwnSuite(source, { writeFiles: false }, done, function (result) {
            expect(result.css).to.eql(source);
            expect(result.warnings()).to.be.empty;
            expect(result.roots).to.be.empty;
        });
    });

    it('Not write files if writeFiles is false', function (done) {
        var source = 'a{}b{}c{}';

        testHelpers.clearTestDir();
        testOwnSuite(source, { maxSelectors: 1, writeFiles: false }, done, function (result) {
            expect(result.warnings()).to.have.length(1);
            expect(result.roots).to.have.length(2);

            if (fs.existsSync(testHelpers.testDir)) {
                expect(fs.readdirSync(testHelpers.testDir)).to.have.length(0);
            }
        });
    });

    it('Fail if there are splitted files and writeFiles is true but opts.to is empty', function (done) {
        var source = 'a{} b{}';

        testOwnSuite(source, { maxSelectors: 1 }, done, function (result) {
            expect(result.warnings()).to.be.not.empty;
            expect(result.roots).to.be.not.empty;
        });
    });

    it('Not split file with less count of selectors than maxSelectors', function (done) {
        test('a{ }', 'a{ }', [], { writeFiles: false }, done);
    });

    it('Split file correctly without warnings by providing maxSelectors', function (done) {
        test('a{} b{}', 'b{}', ['a {}'], { maxSelectors: 1, writeFiles: false, writeImport: false }, done);
    });

    it('Split file to 3 correctly without warning by providing maxSelectors', function (done) {
        test(
            'a{} b{} c{}',
            'c{}',
            ['a {}', 'b {}'],
            { maxSelectors: 1, writeFiles: false, writeImport: false },
            done
        );
    });

    it('Split file to 3 with proper import order', function (done) {
        var source = 'x{} y{} z{}';

        testOwnSuite(source, { maxSelectors: 1, writeFiles: true }, done, function (result) {
            expect(result.warnings()).to.be.empty;
            expect(result.roots.length).to.eql(2);

            var urlRegExp = /url\(|\)/gm;

            var importNode = result.root.nodes[0].params.replace(urlRegExp, '');
            var importNode2 = result.root.nodes[1].params.replace(urlRegExp, '');

            expect(path.basename(result.roots[0].opts.to)).to.eql(importNode);
            expect(path.basename(result.roots[1].opts.to)).to.eql(importNode2);

            expect(result.roots[0].css).to.eql('x{}');
            expect(result.roots[1].css).to.eql('y{}');

            expect(fs.readdirSync(testHelpers.testDir)).to.have.length(2);
            expect(fs.readFileSync(testHelpers.testDir + path.sep + 'test-0.css', 'utf-8')).to.eql('x{}');
            expect(fs.readFileSync(testHelpers.testDir + path.sep + 'test-1.css', 'utf-8')).to.eql('y{}');
        }, {
            to: testHelpers.testPath
        });
    });

    it('Split file correctly with media queries', function (done) {
        test(
            'a{} @media (max-width: 0px) { a{} b{} } c {}',
            '@media (max-width: 0px) { b{} } c {}',
            [
                'a{} @media (max-width: 0px) { a {} }'
            ],
            { maxSelectors: 2, writeFiles: false, writeImport: false },
            done
        );
    });

    it('Split file with empty media queries', function (done) {
        test(
            '@media (max-width: 0px) { a{} b{} }',
            '@media (max-width: 0px) { b{} }',
            [
                '@media (max-width: 0px) { a{} }'
            ],
            { maxSelectors: 1, writeFiles: false, writeImport: false },
            done
        );
    });

    it('Split file with nested atrules', function (done) {
        test(
            '@media (max-width: 0px) { a{} @media (height: 0px) { b {} } c{} }',
            '@media (max-width: 0px) { c{} }',
            [
                '@media (max-width: 0px) { a{} }',
                '@media (max-width: 0px) { @media (height: 0px) { b{} } }'
            ],
            { maxSelectors: 1, writeFiles: false, writeImport: false },
            done
        );
    });

    it('Split file correctly with nested (wrong) media queries', function (done) {
        test(
            '@media (max-width: 0px) { a{} @media (max-height: 0px) { b {} } } c {}',
            'c {}',
            [
                '@media (max-width: 0px) { a{} }',
                '@media (max-width: 0px) { @media (max-height: 0px) { b{} } }'
            ],
            { maxSelectors: 1, writeFiles: false, writeImport: false },
            done
        );
    });

    it('Split file correctly with few selectors in rule', function (done) {
        test(
            'a,b,c {}',
            'c {}',
            [
                'a{}',
                'b{}'
            ],
            { maxSelectors: 1, writeFiles: false, writeImport: false },
            done
        );
    });

    it('Split file correctly with few selectors in rule with data', function (done) {
        test(
            'a,b,c { font-weight: bold; color: red }',
            'c { font-weight: bold; color: red }',
            [
                'a{ font-weight: bold; color: red }',
                'b{ font-weight: bold; color: red }'
            ],
            { maxSelectors: 1, writeFiles: false, writeImport: false },
            done
        );
    });

    it('Should split correctly with moving @font-face', function (done) {
        test(
            'a{} @font-face { font-family:proxima_nova_rgregular; src:url(font.eot); } b{} c{}',
            'c {}',
            [
                'a{} @font-face { font-family:proxima_nova_rgregular; src:url(font.eot); } b{}'
            ],
            { maxSelectors: 2, writeFiles: false, writeImport: false },
            done
        );
    });

    it('Should split correctly with moving @font-face and splitting big selector', function (done) {
        test(
            'a,b{} c{} @font-face { font-family:proxima_nova_rgregular; src:url(font.eot); } d,e{} f{}',
            'e{} f{}',
            [
                'a,b{}',
                'c{} @font-face { font-family:proxima_nova_rgregular; src:url(font.eot); } d{}'
            ],
            { maxSelectors: 2, writeFiles: false, writeImport: false },
            done
        );
    });

    it('Should insert imports after the @charset if any', function (done) {
        var source = '@charset "UTF-8";a{}b{}';

        testOwnSuite(source, { maxSelectors: 1, writeFiles: false }, done, function (result) {
            expect(result.warnings()).to.be.empty;
            expect(result.roots.length).to.eql(1);

            expect(testHelpers.clearCss(result.css)).to.eql(testHelpers.clearCss('@charset "UTF-8";@import url(test-0.css);b{}'));
            expect(result.roots[0].css).to.eql('a{}');
        }, {
            to: testHelpers.testPath
        });
    });

    it('Should insert imports after the first @charset if there are lot of them', function (done) {
        var source = 'a{}b{}@charset "UTF-8";c{}@charset "KOI8-R";d{}';

        testOwnSuite(source, { maxSelectors: 1, writeFiles: false }, done, function (result) {
            expect(result.warnings()).to.be.empty;
            expect(result.roots.length).to.eql(3);

            expect(result.css).to.eql('@charset "UTF-8";@import url(test-0.css);@import url(test-1.css);@import url(test-2.css);@charset "KOI8-R";d{}');
            expect(result.roots[0].css).to.eql('a{}');
            expect(result.roots[1].css).to.eql('b{}');
            expect(result.roots[2].css).to.eql('c{}');
        }, {
            to: testHelpers.testPath
        });
    });

    it('Should insert imports in the beginning of the css if no charset is provided', function (done) {
        var source = 'a{}b{}c{}d{}';

        testOwnSuite(source, { maxSelectors: 1, writeFiles: false }, done, function (result) {
            expect(result.warnings()).to.be.empty;
            expect(result.roots.length).to.eql(3);

            expect(testHelpers.clearCss(result.css)).to.eql(
                testHelpers.clearCss('@import url(test-0.css);@import url(test-1.css);@import url(test-2.css);d{}')
            );
            expect(result.roots[0].css).to.eql('a{}');
            expect(result.roots[1].css).to.eql('b{}');
            expect(result.roots[2].css).to.eql('c{}');
        }, {
            to: testHelpers.testPath
        });
    });

    it('Should move charset to the beginning of the css if it is located in the deep of css', function (done) {
        var source = 'a{}b{}c{}d{}@charset "UTF-8";';

        testOwnSuite(source, { maxSelectors: 1, writeFiles: false }, done, function (result) {
            expect(result.warnings()).to.be.empty;
            expect(result.roots.length).to.eql(3);

            expect(testHelpers.clearCss(result.css)).to.eql(
                testHelpers.clearCss(
                    '@charset "UTF-8";@import url(test-0.css);@import url(test-1.css);@import url(test-2.css);d{}'
                )
            );
            expect(result.roots[0].css).to.eql('a{}');
            expect(result.roots[1].css).to.eql('b{}');
            expect(result.roots[2].css).to.eql('c{}');
        }, {
            to: testHelpers.testPath
        });
    });

    it('New roots should copy raws from original root', function (done) {
        var source = 'a { color:red; } b {color: white }\n';

        testOwnSuite(source, { maxSelectors: 1, writeFiles: false, writeImport: false }, done, function (result) {
            expect(result.warnings()).to.be.empty;
            expect(result.roots.length).to.eql(1);

            expect(result.css).to.eql('b {color: white }\n');
            expect(result.roots[0].css).to.eql('a { color:red; }\n');
        }, {
            to: testHelpers.testPath
        });
    });

});
