var URL = require('url');
var mergeWith = require('lodash/mergeWith');

var extensions = Object.create(URL);
extensions.URL = URL;
extensions.qs = require('qs');

function merge(base /*, updates... */) {
    var args = [], args_i = arguments.length;
    while (args_i-- > 1) args[args_i - 1] = arguments[args_i];

    args.unshift(base);
    args.push(function(base, update) {
        if (Array.isArray(base) || Array.isArray(update))
            return update;
    });

    return mergeWith.apply(null, args);
}

function parseQuery(url) {
    if (typeof url === 'string')
        url = URL.parse(url);

    return extensions.qs.parse((url.search || '').replace(/^\?/, ''));
}

function rebuildQuery(query) {
    return extensions.qs.stringify(query);
}

function applyQuery(url, query) {
    if (typeof query !== 'string')
        query = rebuildQuery(query);

    if (typeof url === 'string')
        url = URL.parse(url);

    url = merge({}, url, {
        search: query ? '?' + query : ''
    });

    return URL.format(url);
}

function addQuery(url, additions, options) {
    options = options || {};

    var query = parseQuery(url);

    if (options.preferNew || typeof options.preferNew === 'undefined') {
        query = merge(query, additions);
    } else {
        query = merge({}, additions, query);
    }

    return applyQuery(url, query);
}

function removeQuery(url, deletions) {
    var i = deletions.length;
    var query = parseQuery(url);

    while (i-- > 0)
        delete query[deletions[i]];

    return applyQuery(url, query);
}

var CONCAT_RE_START = /^\/+/;
var CONCAT_RE_END = /\/+$/;
var CONCAT_RE_BOTH = /^\/+|\/+$/g;
function concatPaths() {
    var parts = new Array(arguments.length);
    for (var i = parts.length - 1; i >= 0; --i) {
        parts[i] = arguments[i];

        if (i === 0)
            parts[i] = parts[i].replace(CONCAT_RE_END, '');
        else if (i === parts.length - 1)
            parts[i] = parts[i].replace(CONCAT_RE_START, '');
        else
            parts[i] = parts[i].replace(CONCAT_RE_BOTH, '');

        if (i !== 0 && !parts[i])
            parts.splice(i, 1);
    }

    return parts.join('/') || '/';
}

/**
 * Use this as tagged template literals:
 *
 * pathEscape`/person/${id}/device/${deviceId}`
 *
 * will return a string in which `id` and `deviceId`
 * have been url-encoded.
 */
function pathEscape(strings/* , ...args */) {
    var args = [], args_i = arguments.length;
    while (args_i-- > 1) args[args_i - 1] = arguments[args_i];

    var out = [];
    var len = strings.length;

    for (var i = 0; i < len; i++) {
        out.push(strings[i]);

        if (typeof args[i] != 'undefined')
            out.push(encodeURIComponent(args[i]));
    }

    return out.join('');
}

extensions.query = {
    parse: parseQuery,
    rebuild: rebuildQuery,
    build: rebuildQuery,

    add: addQuery,
    remove: removeQuery,
    omit: removeQuery,
    set: applyQuery
};

extensions.path = {
    concat: concatPaths,
    escape: pathEscape
};

module.exports = extensions;
