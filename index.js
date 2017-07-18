var URL = require('url');

var extensions = {};
extensions.URL = URL;
extensions.qs = require('qs');

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

    url = Object.assign({}, url, {
        search: query ? '?' + query : ''
    });

    return URL.format(url);
}

function addQuery(url, additions) {
    var query = parseQuery(url);
    query = Object.assign(query, additions);

    return applyQuery(url, query);
}

function removeQuery(url, deletions) {
    var i = deletions.length;
    var query = parseQuery(url);

    while (i-- > 0)
        delete query[deletions[i]];

    return applyQuery(url, query);
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

module.exports = extensions;
