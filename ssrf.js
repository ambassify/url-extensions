var URL = require('url').URL;
var dns = require('dns').promises;
var ipaddr = require('ipaddr.js');

var PROTOCOLS = [ 'http:', 'https:' ];
var DENYLIST_TTL = 60 * 1000;

// Globally-unreachable prefixes ipaddr.js reports as plain `unicast`
var BLOCKED_SUBNETS = {
    // RFC 4291 2.5.5.1
    ipv4Compatible: [ [ ipaddr.parse('::'), 96 ] ],
    // RFC 8215
    nat64LocalUse: [ [ ipaddr.parse('64:ff9b:1::'), 48 ] ],
    // RFC 6666
    discardOnly: [ [ ipaddr.parse('100::'), 64 ] ],
    // RFC 2544
    benchmarking: [ [ ipaddr.parse('198.18.0.0'), 15 ] ],
};

class UnsafeTargetError extends Error {

    static get code() { return 'UnsafeTargetError'; }

    constructor(message) {
        super(message || 'Refusing to fetch this target');

        this.name = 'UnsafeTargetError';
        this.code = UnsafeTargetError.code;
    }

}

function createDenylist(ttl) {
    const cache = new Map();
    let lastSweep = Date.now();

    // Used for tests only
    const _reset = () => { cache.clear(); lastSweep = Date.now(); };

    const clear = (key) => cache.delete(key);

    const sweep = () => {
        if (Date.now() - lastSweep < ttl)
            return;

        lastSweep = Date.now();

        for (const [ key, entry ] of cache) {
            if (entry.expiresAt > Date.now())
                break;

            cache.delete(key);
        }
    };

    const deny = (key, state = true) => {
        // Entries in the map should be kept in insertion order
        // This guarantees that each entry is treated as a new insertion
        clear(key);
        sweep();

        if (state)
            cache.set(key, { expiresAt: Date.now() + ttl });
    };

    const has = (key) => {
        const entry = cache.get(key);

        if (!entry)
            return false;

        if (entry.expiresAt <= Date.now()) {
            clear(key);
            return false;
        }

        return true;
    };

    const entry = (key) => ({
        deny: (state) => deny(key, state),
        clear: () => clear(key),
        has: () => has(key),
    });

    return { deny, clear, has, entry, _reset };
}

var hostDenylist = createDenylist(DENYLIST_TTL);

async function isSSRFSafe(hostname, options = {}) {
    const { dnsRecords } = options;

    const cacheEntry = hostDenylist.entry(hostname);
    if (cacheEntry.has())
        return false;

    const host = hostname.replace(/^\[|\]$/g, '');
    let ips = [ host ];

    if (!ipaddr.isValid(host)) {
        ips = dnsRecords || await dns.lookup(host, { all: true }).catch(err => {
            if (err.code === 'ENOTFOUND')
                return [];
            throw err;
        });

        if (!Array.isArray(ips))
            ips = [ ips ];

        ips = ips.map(r => typeof r === 'string' ? r : r.address);
    }

    const isBlocked = ips.some(ip => {
        if (!ipaddr.isValid(ip))
            return true;

        ip = ipaddr.parse(ip);

        if (ip.kind() == 'ipv6' && ip.isIPv4MappedAddress())
            ip = ip.toIPv4Address();

        if (ip.range() !== 'unicast')
            return true;

        const range = ipaddr.subnetMatch(ip, BLOCKED_SUBNETS, 'allowed');

        return range !== 'allowed';
    });

    cacheEntry.deny(isBlocked);
    return !isBlocked;
}

async function isSSRFSafeURL(url, base) {
    let hostname;
    let protocol;

    try {
        const parsed = new URL(url, base);
        hostname = parsed.hostname;
        protocol = parsed.protocol;

    } catch {
        throw new UnsafeTargetError(`Invalid url: ${url}`);
    }

    if (!PROTOCOLS.includes(protocol))
        return false;

    return await isSSRFSafe(hostname);
}

function toSSRFCallback(cb, fn) {
    if (!cb)
        throw new Error('Missing callback in SSRF check');

    return [
        (safe) => safe ? fn() : cb(new UnsafeTargetError()),
        (err) => cb(err),
    ];
}

// Drop-in for the agents' `lookup` option
function safeLookup(hostname, options, callback) {
    let dnsRecords = null;

    dns.lookup(hostname, options)
        .then(r => { dnsRecords = r; })
        .then(() => isSSRFSafe(hostname, { dnsRecords }))
        .then(...toSSRFCallback(callback, () => {
            // Result type is different between promise and callback API based on options.all
            if (options.all)
                return callback(null, dnsRecords);

            return callback(null, dnsRecords.address, dnsRecords.family);
        }));
}

function createSSRFSafeAgent(Agent, options) {
    const agent = new Agent({ ...options, lookup: safeLookup });
    const createConnection = agent.createConnection;

    agent.createConnection = function(connectOptions, callback) {
        const { host } = connectOptions;

        isSSRFSafe(host).then(...toSSRFCallback(callback, () => {
            callback(null, createConnection.call(this, connectOptions));
        }));
    };

    return agent;
}

async function assertSSRFSafe(hostname, options) {
    if (!await isSSRFSafe(hostname, options))
        throw new UnsafeTargetError();
}

async function assertSSRFSafeURL(hostname, base) {
    if (!await isSSRFSafeURL(hostname, base))
        throw new UnsafeTargetError();
}

module.exports = {
    UnsafeTargetError,

    hostDenylist,

    isSSRFSafe,
    isSSRFSafeURL,

    assertSSRFSafe,
    assertSSRFSafeURL,

    safeLookup,
    createSSRFSafeAgent,
};
