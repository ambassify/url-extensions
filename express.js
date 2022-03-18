var assign = require('lodash/assign');

var extensions = assign({}, require('./index'));
var express = extensions.express = assign({}, extensions.express);

express.host = function expressHost(req) {
    return (req.get('x-forwarded-host') || req.get('host') || '')
        .split(',').shift();
};

express.hostname = function expressHostname(req) {
    return express.host(req).replace(/:\d+$/i, '');
};

express.protocol = function expressProtocol(req) {
    return (req.get('x-forwarded-proto') || req.protocol)
        .split(',').shift();
};

express.baseUrl = function expressBaseUrl(req) {
    var host = express.host(req);
    var protocol = express.protocol(req);

    return protocol + '://' + host + req.baseUrl;
};

express.requested = function expressRequested(req) {
    return express.baseUrl(req) + req.url;
};

module.exports = extensions;
