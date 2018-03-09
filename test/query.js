'use strict';

var assert = require('assert');

describe('URL', function() {

    var URL = require('..');

    describe('Query', function() {
        it('Should add query parameters', function() {
            var url = 'https://www.google.com';
            var next = URL.query.add(url, { 'utm_campaign': 'url-extensions' });

            assert.equal(next, 'https://www.google.com/?utm_campaign=url-extensions');
        });

        it('Should add multiple query parameters', function() {
            var url = 'https://www.google.com';
            var next = URL.query.add(url, {
                'utm_campaign': 'url-extensions',
                'utm_source': 'unit-test'
            });

            assert.equal(next, 'https://www.google.com/?utm_campaign=url-extensions&utm_source=unit-test');
        });

        it('Should add multiple query parameters when missing', function() {
            var url = 'https://www.google.com?utm_campaign=Ambassify';
            var next = URL.query.add(url, {
                'utm_campaign': 'url-extensions',
                'utm_source': 'unit-test'
            }, { preferNew: false });

            assert.equal(next, 'https://www.google.com/?utm_campaign=Ambassify&utm_source=unit-test');
        });

        it('Should remove query parameters', function() {
            var url = 'https://www.google.com?utm_campaign=url-extensions&utm_source=unit-test';
            var next = URL.query.remove(url, ['utm_campaign']);

            assert.equal(next, 'https://www.google.com/?utm_source=unit-test');
        });

        it('Should remove multiple query parameters', function() {
            var url = 'https://www.google.com?utm_campaign=url-extensions&utm_source=unit-test';
            var next = URL.query.remove(url, ['utm_campaign','utm_source']);

            assert.equal(next, 'https://www.google.com/');
        });

        it('Should handle url objects', function() {
            var url = URL.URL.parse('https://www.google.com?utm_campaign=url-extensions&utm_source=unit-test');
            var next = URL.query.remove(url, ['utm_campaign','utm_source']);

            assert.equal(next, 'https://www.google.com/');
        });
    });
});
