var assign = require('lodash/assign');

var extensions = assign({}, require('./index'));
var hapi = extensions.hapi = assign({}, extensions.hapi);

function trim(v) {
    return v.replace(/^\s+|\s+$/ig, '');
}

hapi.forwarded = function hapiForwarded(request, type, hop) {
    type = type.toLowerCase();
    hop = hop || 0;

    var headers = request.headers || {};
    var list = (headers['x-forwarded-' + type] || '')
        .split(',')
        .map(trim);

    return list[hop];
};

hapi.proto = function hapiProto(request) {
    return hapi.forwarded(request, 'proto') ||
        request.connection.info.protocol;
};

hapi.host = function hapiHost(request) {
    return hapi.forwarded(request, 'host') ||
        request.info.host;
};

hapi.requested = function hapiRequested(request) {
    var host = hapi.host(request);
    var proto = hapi.proto(request);

    return [
        proto,
        '://',
        host,
        request.url.path
    ].join('');
};

hapi.baseUrl = function hapiBaseUrl(request) {
    var host = hapi.host(request);
    var proto = hapi.proto(request);

    return [
        proto,
        '://',
        host
    ].join('');
};

module.exports = extensions;
