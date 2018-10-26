'use strict';

var assert = require('assert');

describe('HapiJS', function () {

    var URL = require('../hapi');

    describe('baseUrl', function () {

        it('Should extract the baseUrl from a request', function () {
            var baseUrl = 'https://localhost:3000';
            var req = {
                connection: {
                    info: { protocol: 'https' }
                },
                info: {
                    host: 'localhost:3000'
                },
                url: {
                    path: '/test'
                }
            };

            var result = URL.hapi.baseUrl(req);
            assert.equal(result, baseUrl);
        });

        it('Should extract the baseUrl from a proxied request', function () {
            var baseUrl = 'https://ambassify.com';
            var req = {
                connection: {
                    info: { protocol: 'https' }
                },
                info: {
                    host: 'localhost:3000'
                },
                url: {
                    path: '/test'
                },
                headers: {
                    'x-forwarded-host': 'ambassify.com'
                }
            };

            var result = URL.hapi.baseUrl(req);
            assert.equal(result, baseUrl);
        });
    })

    describe('requested', function() {
        it('should extract the requested URL from a request', function () {
            var requested = 'https://localhost:3000/test/index.html';
            var req = {
                connection: {
                    info: { protocol: 'https' }
                },
                info: {
                    host: 'localhost:3000'
                },
                url: {
                    path: '/test/index.html'
                }
            };

            var result = URL.hapi.requested(req);
            assert.equal(result, requested);
        })
    })

})
