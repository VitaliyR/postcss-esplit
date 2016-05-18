var postcss = require('postcss');
var chai = require('chai');
var expect = chai.expect;

var testHelpers = require('./test_helpers');

var csswring = require('csswring');
var plugin = require('../');

describe('Integration', function () {

    it('Plugin should run after other plugins', function (done) {
        var opts = {
            writeFiles: false,
            writeImport: false,
            maxSelectors: 1
        };
        var input = 'a{ color: red; }\nb{ font-weight : 700 }\nc{}';

        postcss([plugin(opts), csswring()]).process(input, { to: testHelpers.testPath })
            .then(function (result) {
                expect(result.warnings()).to.be.empty;
                expect(result.roots).to.have.length(1); // because csswring will remove c{}
                expect(result.roots[0].css).to.eql('a{color:red}');
                expect(result.css).to.eql('b{font-weight:700}');
                done();
            }).catch(done);
    });

});
