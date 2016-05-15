/* eslint max-len: [2, 160] */

var postcss = require('postcss');
var chai = require('chai');
var expect = chai.expect;
var AssertionError = chai.AssertionError;
var path = require('path');
var pkg = require('../package.json');

var plugin = require('../');
var helpers = require('../lib/helpers');

/**
 * For temporary outputting css files
 * @const
 * @type {string}
 */
var testPath = 'test/output/test.css';
var testDir = 'test/output';


/* TEST METHODS */

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
    var spaceRegexp = / |\n/gmi;

    args.push(function (result) {
        expect(result.css.replace(spaceRegexp, '')).to.eql(output.replace(spaceRegexp, ''));
        expect(result.warnings()).to.be.empty;

        if (splittedFiles.length) {
            expect(result.roots.length).to.be.eql(splittedFiles.length);
            result.roots.forEach(function (root, index) {
                expect(root.css.replace(spaceRegexp, '')).to.eql(splittedFiles[index].replace(spaceRegexp, ''));
            });
        }
    });

    testOwnSuite.apply(this, args);
};


/* LIB TESTS */

describe('helpers', function () {

    it('Defaults should extend objects', function (done) {
        var a = {};
        var b = { param: true };

        var c = helpers.defaults(a, b);

        expect(c).to.eql(a);
        expect(c.param).to.eql(b.param);

        done();
    });

    it('Defaults should not rewrite already defined parameters in source', function (done) {
        var a = { param: true };
        var b = { param: false };

        var c = helpers.defaults(a, b);

        expect(c.param).to.eql(true);

        done();
    });

    it('Extend should extend objects for first argument', function (done) {
        var a = {};
        var b = {};
        var c = { something: false };

        var d = helpers.extend(a, b, c);

        expect(d).to.eql(a);
        expect(d).to.not.eql(b);

        done();
    });

    it('Extend should not deeply extend objects', function (done) {
        var a = {};
        var b = {
            something: {
                test: true
            }
        };

        helpers.extend(a, b);

        expect(a.something).to.be.eql(b.something);

        helpers.extend(a, {
            something: {
                another: false
            }
        });

        expect(a.something.test).to.eql(undefined);
        expect(a.something.another).to.eql(false);

        done();
    });

    it('getFileName should return proper filename', function (done) {
        var destination = path.parse(testPath);
        var fileName;

        fileName = helpers.getFileName('test', destination, 0);
        expect(fileName).to.be.eql(testPath);

        fileName = helpers.getFileName('test-%i%', destination, 11);
        expect(fileName).to.be.eql(testDir + '/test-11.css');

        fileName = helpers.getFileName('%original%test%i%', destination, 1);
        expect(fileName).to.be.eql(testDir + '/testtest1.css');

        done();
    });

    it('find should find object in array', function (done) {
        var obj00 = { iam: '00' };
        var obj01 = { iam: '01' };
        var obj10 = { iam: '10' };
        var obj11 = { iam: '11' };
        var obj20 = { iam: '20' };
        var obj21 = { iam: '21' };
        var arr = [
            [obj00, obj01],
            [obj10, obj11],
            [obj20, obj21]
        ];
        var obj;

        obj = helpers.find(obj20, arr);
        expect(obj).to.be.eql(obj21);

        obj = helpers.find(obj10, arr);
        expect(obj).to.be.eql(obj11);

        obj = helpers.find(obj21, arr);
        expect(obj).to.be.not.ok;

        done();
    });

    it('parents should return all parents', function (done) {
        var root = postcss.root();
        var node = postcss.parse('@media (max-heigth: 10px){ a{} @media (max-width: 10px) { b{} } }');
        root.append(node);
        var parents;

        parents = helpers.parents(root);
        expect(parents).to.have.length(0);

        parents = helpers.parents(root.nodes[0]);
        expect(parents).to.have.length(0);

        parents = helpers.parents(root.nodes[0].nodes[1].nodes[0]);
        expect(parents).to.have.length(2);
        expect(parents[1]).to.be.eql(root.nodes[0]);

        done();
    });

});


/* PLUGIN TESTS */

describe(pkg.name, function () {

    it('Find plugin duplicates and remove them from processor list', function (done) {
        var opts = {
            writeFiles: false,
            maxSelectors: 1
        };
        var input = 'a{}b{}c{}';

        postcss([plugin(opts), plugin(opts), plugin(opts)]).process(input, { to: testPath })
            .then(function (result) {
                expect(result.warnings()).to.be.empty;
                expect(result.processor.plugins.length).to.eql(1);
                expect(result.roots[0].processor.plugins.length).to.eql(0);
                expect(result.roots[1].processor.plugins.length).to.eql(0);
                done();
            }).catch(done);
    });

    it('Correct plugins for children roots processor', function (done) {
        var tempPlugin = postcss.plugin('postcss-temp', function () {
            return function () {
            };
        });

        var opts = {
            writeFiles: false,
            maxSelectors: 1
        };
        var input = 'a{}b{}c{}';

        postcss([
            tempPlugin(),
            plugin(opts),
            plugin(opts),
            tempPlugin()
        ]).process(input, { to: testPath })
            .then(function (result) {
                expect(result.warnings()).to.be.empty;
                expect(result.processor.plugins.length).to.eql(3);
                expect(result.roots[0].processor.plugins.length).to.eql(1);
                expect(result.roots[1].processor.plugins.length).to.eql(1);
                done();
            }).catch(done);
    });

    it('There are no splitted files even if writeFiles is true', function (done) {
        var source = 'a{}';

        testOwnSuite(source, { writeFiles: false }, done, function (result) {
            expect(result.css).to.eql(source);
            expect(result.warnings()).to.be.empty;
            expect(result.roots).to.be.empty;
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
        var source = 'a{} b{} c{}';

        testOwnSuite(source, { maxSelectors: 1, writeFiles: false }, done, function (result) {
            expect(result.warnings()).to.be.empty;
            expect(result.roots.length).to.eql(2);

            var urlRegExp = /url\(|\)/gm;

            var importNode = result.root.nodes[0].params.replace(urlRegExp, '');
            var importNode2 = result.root.nodes[1].params.replace(urlRegExp, '');

            expect(path.basename(result.roots[0].opts.to)).to.eql(importNode);
            expect(path.basename(result.roots[1].opts.to)).to.eql(importNode2);

            expect(result.roots[0].css).to.eql('a {}');
            expect(result.roots[1].css).to.eql('b {}');
        }, {
            to: testPath
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

});
