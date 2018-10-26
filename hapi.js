var assign = require('lodash/assign');

var extensions = assign({}, require('./index'));
var hapi = extensions.hapi = assign({}, extensions.hapi);

hapi.forwarded = function hapiForwarded(request, type, hop = 0) {
    const list = (request.headers[`x-forwarded-${type}`] || '')
        .split(',')
        .map(p => p.trim());

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
    const host = hapi.host(request);
    const proto = hapi.proto(request);
    return `${proto}://${host}${request.url.path}`;
};

hapi.baseUrl = function hapiBaseUrl(request) {
    const host = extras.host(request);
    const proto = extras.proto(request);
    return `${proto}://${host}`;
};

module.exports = extensions;
