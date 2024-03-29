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

        it('should concatenate non-string path parts', function() {
            const parts = [ 'foo', 12, true ];
            const expects = 'foo/12/true';
            assert.strictEqual(ext.path.concat.apply(null, parts), expects);
        });

        it('should escape path templates', () => {
            const identityId = 'auth0:test';
            const expected = `/identity/${encodeURIComponent(identityId)}`;
            const result = ext.path.escape`/identity/${identityId}`;

            assert.equal(result, expected);
        });

        it('should escape path templates with more than one variable', () => {
            const foo = 'foo';
            const baz = 'baz';
            const result = ext.path.escape`/${foo}/bar/${baz}`;

            assert.equal(result, '/foo/bar/baz');
        });

        [
            { path: '/foo/bar', expected: '/foo/bar' },
            { path: '/foo/./bar', expected: '/foo/bar' },
            { path: './foo/bar', expected: '/foo/bar' },
            { path: './foo/../../bar', expected: '/bar' },
            { path: '/foo/.././bar', expected: '/bar' },
            { path: '/foo/../bar', expected: '/bar' },
            { path: '/foo/../bar/../../..', expected: '/' },
            { path: '/foo/../bar/../../../baz', expected: '/baz' },
        ].forEach(({ path, expected }) => it(
            `Should normalize path: ${path}`,
            function() {
                assert.equal(ext.path.normalize(path), expected);
            }
        ));

    })

});
