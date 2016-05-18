var postcss = require('postcss');
var chai = require('chai');
var expect = chai.expect;

var path = require('path');
var testHelpers = require('./test_helpers');

var helpers = require('../lib/helpers');


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
        var destination = path.parse(testHelpers.testPath);
        var fileName;

        fileName = helpers.getFileName('test', destination, 0);
        expect(fileName).to.be.eql(testHelpers.testPath);

        fileName = helpers.getFileName('test-%i%', destination, 11);
        expect(fileName).to.be.eql(testHelpers.testDir + '/test-11.css');

        fileName = helpers.getFileName('%original%test%i%', destination, 1);
        expect(fileName).to.be.eql(testHelpers.testDir + '/testtest1.css');

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
        var node = postcss.parse(
            '@media (max-heigth: 10px){ a{} @media (max-width: 10px) { b{} } }'
        );
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
