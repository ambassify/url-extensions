'use strict';

var assert = require('assert');

describe('URL', function() {

    var ext = require('..');

    describe('Path', function() {
        
        [
            { args: [ 'foo', 'bar' ], expected: 'foo/bar' },
            { args: [ 'foo', 'bar', 'baz' ], expected: 'foo/bar/baz' },
            { args: [ 'foo/', 'bar' ], expected: 'foo/bar' },
            { args: [ 'foo/', '/bar' ], expected: 'foo/bar' },
            { args: [ '/foo/', '/bar/' ], expected: '/foo/bar/' },
            { args: [ '/foo//', '//bar/' ], expected: '/foo/bar/' },
            { args: [ '/', '/' ], expected: '/' },
            { args: [ '/', '/foo' ], expected: '/foo' },
            { args: [ '/foo', '/' ], expected: '/foo' },
            { args: [ '/foo', '' ], expected: '/foo' },
            { args: [ '', '' ], expected: '/' },
            { args: [ '' ], expected: '/' },
            { args: [], expected: '/' },
        ].forEach(({ args, expected }) => it(
            `Should concatenate path parts: ${args.map(JSON.stringify).join(', ')}`,
            function() {
                assert.equal(ext.path.concat.apply(null, args), expected);
            }
        ));

        it('should escape path templates', () => {
            const identityId = 'auth0:test';
            const expected = `/identity/${encodeURIComponent(identityId)}`;
            const result = ext.path.escape`/identity/${identityId}`;

            assert.equal(result, expected);
        })

        it('should escape path templates with more than one variable', () => {
            const foo = 'foo';
            const baz = 'baz';
            const result = ext.path.escape`/${foo}/bar/${baz}`;

            assert.equal(result, '/foo/bar/baz');
        })

    })

});
