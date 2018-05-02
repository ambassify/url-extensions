var assign = require('lodash/assign');

var extensions = assign({}, require('./index'));
var express = extensions.express = assign({}, extensions.express);

express.baseUrl = function expressBaseUrl(req) {
    var host = req.get('x-forwarded-host') || req.get('host');
    return `${req.protocol}://${host}${req.baseUrl}`;
};

express.requested = function expressRequested(req) {
    return express.baseUrl(req) + req.url;
};

module.exports = extensions;
