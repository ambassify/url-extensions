'use strict';

var assert = require('assert');

describe('Express', function () {

    var URL = require('../express');

    describe('baseUrl', function () {

        it('Should extract the baseUrl from a request', function () {
            var baseUrl = 'https://localhost:3000/test';
            var req = {
                protocol: 'https',
                baseUrl: '/test',
                get: k => {
                    if (k == 'host')
                        return 'localhost:3000';
                }
            };

            var result = URL.express.baseUrl(req);
            assert.equal(result, baseUrl);
        });

        it('Should extract the baseUrl from a proxied request', function () {
            var baseUrl = 'https://ambassify.com/test';
            var req = {
                protocol: 'https',
                baseUrl: '/test',
                get: k => {
                    if (k == 'host')
                        return 'localhost:3000';
                    if (k == 'x-forwarded-host')
                        return 'ambassify.com,ambassify.eu';
                    if (k == 'x-forwared-proto')
                        return 'https,http,http';
                }
            };

            var result = URL.express.baseUrl(req);
            assert.equal(result, baseUrl);
        });
    })

    describe('requested', function() {
        it('should extract the requested URL from a request', function () {
            var requested = 'https://localhost:3000/test/index.html';
            var req = {
                protocol: 'https',
                baseUrl: '/test',
                url: '/index.html',
                get: k => {
                    if (k == 'host')
                        return 'localhost:3000';
                }
            };

            var result = URL.express.requested(req);
            assert.equal(result, requested);
        })
    })

    describe('host', function() {
        it('should extract the host from a request', function () {
            var req = {
                protocol: 'https',
                baseUrl: '/test',
                url: '/index.html',
                get: k => {
                    if (k == 'host')
                        return 'localhost:3000';
                }
            };

            var result = URL.express.host(req);
            assert.equal(result, 'localhost:3000');
        })
    })
    
    describe('hostname', function() {
        it('should extract the hostname from a request', function () {
            var req = {
                protocol: 'https',
                baseUrl: '/test',
                url: '/index.html',
                get: k => {
                    if (k == 'host')
                        return 'localhost:3000';
                }
            };

            var result = URL.express.hostname(req);
            assert.equal(result, 'localhost');
        })
        
        it('should extract the hostname from a request with IP', function () {
            var req = {
                protocol: 'https',
                baseUrl: '/test',
                url: '/index.html',
                get: k => {
                    if (k == 'host')
                        return '127.0.0.1:3000';
                }
            };

            var result = URL.express.hostname(req);
            assert.equal(result, '127.0.0.1');
        })
        
        it('should extract the hostname from a request with only IP', function () {
            var req = {
                protocol: 'https',
                baseUrl: '/test',
                url: '/index.html',
                get: k => {
                    if (k == 'host')
                        return '127.0.0.1';
                }
            };

            var result = URL.express.hostname(req);
            assert.equal(result, '127.0.0.1');
        })
    })
    
    describe('protocol', function() {
        it('should extract the protocol from a request', function () {
            var req = {
                protocol: 'https',
                baseUrl: '/test',
                url: '/index.html',
                get: k => {
                    if (k == 'host')
                        return 'localhost:3000';
                }
            };

            var result = URL.express.protocol(req);
            assert.equal(result, 'https');
        })
    })

})
