'use strict';

var assert = require('assert');
var mock = require('mock-require');

const ADDRESSES = {
    'public.test': [ { address: '93.184.216.34', family: 4 } ],
    'public-v6.test': [ { address: '2001:4860:4860::8888', family: 6 } ],
    'loopback.test': [ { address: '127.0.0.1', family: 4 } ],
    'loopback-v6.test': [ { address: '::1', family: 6 } ],
    'private.test': [ { address: '10.11.12.13', family: 4 } ],
    'private-2.test': [ { address: '192.168.1.1', family: 4 } ],
    'metadata.test': [ { address: '169.254.169.254', family: 4 } ],
    'unique-local.test': [ { address: 'fd00::1', family: 6 } ],
    'link-local-v6.test': [ { address: 'fe80::1', family: 6 } ],
    'multicast.test': [ { address: '224.0.0.1', family: 4 } ],
    'cgnat.test': [ { address: '100.64.0.1', family: 4 } ],
    'unspecified.test': [ { address: '0.0.0.0', family: 4 } ],
    'mapped-loopback.test': [ { address: '::ffff:127.0.0.1', family: 6 } ],
    'mapped-public.test': [ { address: '::ffff:8.8.8.8', family: 6 } ],
    'ipv4-compatible.test': [ { address: '::7f00:1', family: 6 } ],
    'nat64-local.test': [ { address: '64:ff9b:1::1', family: 6 } ],
    'discard-only.test': [ { address: '100::1', family: 6 } ],
    'benchmarking.test': [ { address: '198.18.0.1', family: 4 } ],
    'garbage.test': [ { address: 'not-an-address', family: 4 } ],
    'mixed.test': [
        { address: '93.184.216.34', family: 4 },
        { address: '127.0.0.1', family: 4 },
    ],
    // The denylist is cleared before every test, so the per-test hostnames below
    // only record which test each address belongs to.
    'cached-block.test': [ { address: '10.0.0.9', family: 4 } ],
    'expired-block.test': [ { address: '10.0.0.10', family: 4 } ],
    'mixed-refused.test': [
        { address: '93.184.216.34', family: 4 },
        { address: '192.168.0.9', family: 4 },
    ],
    'all-addresses.test': [ { address: '93.184.216.35', family: 4 } ],
    'mock-probe.test': [ { address: '10.0.0.11', family: 4 } ],
    'private-lookup.test': [ { address: '10.0.0.12', family: 4 } ],
    'transport.test': [ { address: '93.184.216.36', family: 4 } ],
    'agent-public.test': [ { address: '93.184.216.37', family: 4 } ],
    'assert-public.test': [ { address: '93.184.216.38', family: 4 } ],
    'scoped.test': [ { address: '10.0.0.13', family: 4 } ],
    '169.254.169.254': [ { address: '169.254.169.254', family: 4 } ],
    '127.0.0.1': [ { address: '127.0.0.1', family: 4 } ],
    '8.8.8.8': [ { address: '8.8.8.8', family: 4 } ],
    '::1': [ { address: '::1', family: 6 } ],
};

const UNSUPPORTED_SCHEMES = [
    'file:///etc/passwd',
    'view-source:file:///etc/passwd',
    'filesystem:file:///persistent/x',
    'data:text/html,<script>1</script>',
    'blob:https://public.test/1234',
    'about:blank',
    'chrome://settings',
    'devtools://devtools/bundled/inspector.html',
    'ftp://public.test/secret',
];

const INVALID_URLS = [ '', 'not a url', 'http://', '///nohost' ];

const BLOCKED_HOSTS = [
    'loopback.test',
    'loopback-v6.test',
    'private.test',
    'private-2.test',
    'metadata.test',
    'unique-local.test',
    'link-local-v6.test',
    'multicast.test',
    'cgnat.test',
    'unspecified.test',
    'mapped-loopback.test',
    'ipv4-compatible.test',
    'nat64-local.test',
    'discard-only.test',
    'benchmarking.test',
    'garbage.test',
    'mixed.test',
];

const UNSAFE_TARGET_CODE = 'UnsafeTargetError';
// Mirrors DENYLIST_TTL in ssrf.js, which is not exported
const DENYLIST_TTL = 60 * 1000;

describe('SSRF guard', () => {

    let ssrf = null;
    let guard = null;
    let UnsafeTargetError = null;
    let lookups = [];

    const TEMP_FAILURE_HOST = 'temp-failure.test';

    function isInvalidUrl(err) {
        return err.code == UNSAFE_TARGET_CODE && /Invalid url/.test(err.message);
    }

    function dnsError(hostname) {
        const code = hostname == TEMP_FAILURE_HOST ? 'EAI_AGAIN' : 'ENOTFOUND';

        return Object.assign(
            new Error(`getaddrinfo ${code} ${hostname}`),
            { code }
        );
    }

    async function dnsLookup(hostname, options = {}) {
        lookups.push({ hostname, options });

        const addresses = ADDRESSES[hostname];

        if (!addresses)
            throw dnsError(hostname);

        return options.all ? addresses : addresses[0];
    }

    before(() => {
        const promises = { lookup: dnsLookup };

        mock('dns', { promises });
        mock('dns/promises', promises);

        ssrf = require('../ssrf');
        guard = ssrf;
        UnsafeTargetError = ssrf.UnsafeTargetError;
    });

    after(() => {
        mock.stopAll();
    });

    // The guard keeps refused hostnames in a 60s denylist. Clearing it per test is
    // what makes every refusal below come from classification instead of an entry
    // a previous test left behind.
    beforeEach(() => {
        lookups = [];
        guard.hostDenylist._reset();
    });

    it('should not expose the url extensions', () => {
        [ 'query', 'path', 'URL', 'qs', 'create' ].forEach(key => {
            assert.strictEqual(key in ssrf, false, `Expected ${key} not to be exposed`);
        });

        assert.strictEqual(typeof ssrf.assertSSRFSafeURL, 'function');
    });

    // Fails loudly if the specifier ssrf.js imports stops being intercepted:
    // real dns makes every `.test` host ENOTFOUND, which the guard reports as safe,
    // and the whole suite would otherwise pass while checking nothing.
    it('should have dns intercepted by the mock', async () => {
        assert.equal(
            await guard.isSSRFSafe('mock-probe.test'),
            false,
            'The dns mock is not intercepting the module ssrf.js imports'
        );
        assert.deepEqual(
            lookups.map(l => l.hostname),
            [ 'mock-probe.test' ],
            'Expected the mocked lookup to have received the hostname'
        );
    });

    describe('#isSSRFSafe()', () => {

        it('should allow a hostname resolving to a public address', async () => {
            assert.equal(await guard.isSSRFSafe('public.test'), true);
        });

        it('should allow a hostname resolving to a public IPv6 address', async () => {
            assert.equal(await guard.isSSRFSafe('public-v6.test'), true);
        });

        it('should allow a public ip literal without resolving it', async () => {
            assert.equal(await guard.isSSRFSafe('8.8.8.8'), true);
            assert.equal(lookups.length, 0, 'Expected no dns lookup for an ip literal');
        });

        BLOCKED_HOSTS.forEach(hostname => {
            it(`should refuse ${hostname}`, async () => {
                assert.equal(
                    await guard.isSSRFSafe(hostname),
                    false,
                    `Expected ${hostname} to be refused`
                );
            });
        });

        it('should refuse a loopback literal in IPv6 notation with brackets', async () => {
            assert.equal(await guard.isSSRFSafe('[::1]'), false);
        });

        // ipaddr.js reports each of these as plain `unicast`; the guard's own
        // subnet table is the only thing refusing them.
        [ '[::7f00:1]', '[64:ff9b:1::1]', '[100::1]', '198.18.0.1', '198.19.255.255' ]
            .forEach(literal => {
                it(`should refuse the literal ${literal}`, async () => {
                    assert.equal(
                        await guard.isSSRFSafe(literal),
                        false,
                        `Expected ${literal} to be refused`
                    );
                    assert.equal(lookups.length, 0, 'Expected no dns lookup for an ip literal');
                });
            });

        // Guards the subnet table against an over-broad `::/96` rule, which would
        // silently refuse every IPv4-mapped address.
        it('should allow an IPv4-mapped public address', async () => {
            assert.equal(await guard.isSSRFSafe('[::ffff:8.8.8.8]'), true);
            assert.equal(await guard.isSSRFSafe('mapped-public.test'), true);
        });

        it('should allow addresses adjacent to the blocked subnets', async () => {
            assert.equal(await guard.isSSRFSafe('198.17.255.255'), true);
            assert.equal(await guard.isSSRFSafe('198.20.0.0'), true);
            assert.equal(await guard.isSSRFSafe('[100:1::1]'), true);
        });

        it('should treat an unresolvable hostname as safe', async () => {
            assert.equal(await guard.isSSRFSafe('unknown-host.test'), true);
        });

        it('should pass on a dns failure that is not ENOTFOUND', async () => {
            await assert.rejects(
                guard.isSSRFSafe('temp-failure.test'),
                err => err.code == 'EAI_AGAIN'
            );
        });

    });

    describe('#isSSRFSafeURL()', () => {

        it('should allow a public http url', async () => {
            assert.equal(await guard.isSSRFSafeURL('http://public.test/some/path?a=1'), true);
        });

        UNSUPPORTED_SCHEMES.forEach(url => {
            it(`should refuse ${url}`, async () => {
                assert.equal(
                    await guard.isSSRFSafeURL(url),
                    false,
                    `Expected ${url} to be refused`
                );
                assert.equal(lookups.length, 0, 'Expected no dns lookup for a refused scheme');
            });
        });

        INVALID_URLS.forEach(url => {
            it(`should throw on invalid url "${url}"`, async () => {
                await assert.rejects(
                    guard.isSSRFSafeURL(url),
                    isInvalidUrl,
                    `Expected "${url}" to be refused`
                );
            });
        });

        it('should refuse the cloud metadata address given as a literal', async () => {
            assert.equal(await guard.isSSRFSafeURL('http://169.254.169.254/latest/meta-data/'), false);
        });

        it('should refuse a loopback literal in IPv6 notation', async () => {
            assert.equal(await guard.isSSRFSafeURL('http://[::1]:8080/'), false);
        });

        // `http://[::127.0.0.1]/` canonicalises to the hostname `[::7f00:1]`
        [
            'http://[::127.0.0.1]/',
            'http://[64:ff9b:1::1]/',
            'http://[100::1]/',
            'http://198.18.0.1/',
        ].forEach(url => {
            it(`should refuse ${url}`, async () => {
                assert.equal(
                    await guard.isSSRFSafeURL(url),
                    false,
                    `Expected ${url} to be refused`
                );
            });
        });

        it('should allow an url on an IPv4-mapped public address', async () => {
            assert.equal(await guard.isSSRFSafeURL('http://[::ffff:8.8.8.8]/'), true);
        });

        it('should resolve a relative target against its base', async () => {
            assert.equal(await guard.isSSRFSafeURL('/next?x=1', 'https://public.test/first'), true);
            assert.deepEqual(lookups.map(l => l.hostname), [ 'public.test' ]);
        });

        it('should refuse a relative target whose base is refused', async () => {
            assert.equal(await guard.isSSRFSafeURL('/next', 'https://private.test/first'), false);
        });

        it('should refuse a scheme change on a relative target', async () => {
            assert.equal(await guard.isSSRFSafeURL('file:///etc/passwd', 'https://public.test/first'), false);
        });

        it('should resolve a protocol-relative target against its base', async () => {
            assert.equal(await guard.isSSRFSafeURL('//private.test/x', 'https://public.test/first'), false);
        });

        it('should cache a refused hostname without hitting dns again', async () => {
            assert.equal(await guard.isSSRFSafeURL('https://cached-block.test/a'), false);
            assert.equal(lookups.length, 1);

            assert.equal(await guard.isSSRFSafeURL('https://cached-block.test/b'), false);
            assert.equal(lookups.length, 1, 'Expected the refused hostname to be served from cache');
        });

        it('should resolve a refused hostname again once its cache entry expired', async () => {
            assert.equal(await guard.isSSRFSafeURL('https://expired-block.test/a'), false);
            assert.equal(lookups.length, 1);

            const now = Date.now;
            Date.now = () => now() + 61 * 1000;

            try {
                assert.equal(await guard.isSSRFSafeURL('https://expired-block.test/b'), false);
            } finally {
                Date.now = now;
            }

            assert.equal(lookups.length, 2, 'Expected the expired entry to be resolved again');
        });

        it('should not cache a hostname that passed', async () => {
            await guard.isSSRFSafeURL('https://public.test/a');
            await guard.isSSRFSafeURL('https://public.test/b');

            assert.equal(lookups.length, 2, 'Expected every allowed target to be resolved again');
        });

    });

    describe('#assertSSRFSafe()', () => {

        it('should return undefined for a public hostname', async () => {
            assert.equal(await guard.assertSSRFSafe('assert-public.test'), undefined);
        });

        it('should forward the hostname it was given', async () => {
            await guard.assertSSRFSafe('assert-public.test');

            assert.deepEqual(lookups.map(l => l.hostname), [ 'assert-public.test' ]);
        });

        it('should throw an UnsafeTargetError for a refused hostname', async () => {
            await assert.rejects(
                guard.assertSSRFSafe('private.test'),
                err => err instanceof UnsafeTargetError && err.code == UNSAFE_TARGET_CODE
            );
        });

    });

    describe('#assertSSRFSafeURL()', () => {

        it('should return undefined for a public url', async () => {
            assert.equal(await guard.assertSSRFSafeURL('https://public.test/a'), undefined);
        });

        it('should forward the base so a relative target resolves', async () => {
            assert.equal(
                await guard.assertSSRFSafeURL('/next?x=1', 'https://public.test/first'),
                undefined
            );
            assert.deepEqual(lookups.map(l => l.hostname), [ 'public.test' ]);
        });

        it('should throw when a relative target resolves onto a refused base', async () => {
            await assert.rejects(
                guard.assertSSRFSafeURL('/next?x=1', 'https://private.test/first'),
                err => err instanceof UnsafeTargetError && err.code == UNSAFE_TARGET_CODE
            );
        });

        UNSUPPORTED_SCHEMES.forEach(url => {
            it(`should throw an UnsafeTargetError for ${url}`, async () => {
                await assert.rejects(
                    guard.assertSSRFSafeURL(url),
                    err => err instanceof UnsafeTargetError && err.code == UNSAFE_TARGET_CODE,
                    `Expected ${url} to be refused`
                );
                assert.equal(lookups.length, 0, 'Expected no dns lookup for a refused scheme');
            });
        });

        BLOCKED_HOSTS.forEach(hostname => {
            const url = `https://${hostname}/`;

            it(`should throw an UnsafeTargetError for ${url}`, async () => {
                await assert.rejects(
                    guard.assertSSRFSafeURL(url),
                    err => err instanceof UnsafeTargetError && err.code == UNSAFE_TARGET_CODE,
                    `Expected ${url} to be refused`
                );
                assert.notEqual(
                    lookups.length,
                    0,
                    `Expected ${hostname} to be classified, not read from the denylist`
                );
            });
        });

        INVALID_URLS.forEach(url => {
            it(`should throw an UnsafeTargetError for invalid url "${url}"`, async () => {
                await assert.rejects(
                    guard.assertSSRFSafeURL(url),
                    err => err instanceof UnsafeTargetError && /Invalid url/.test(err.message),
                    `Expected "${url}" to be refused`
                );
            });
        });

    });

    describe('#createSSRFSafeAgent()', () => {

        let connected = [];

        class FakeAgent {

            constructor(options) {
                this.options = options;
            }

            createConnection(connectOptions, callback) {
                connected.push(connectOptions);

                if (callback)
                    callback(null, {});

                return {};
            }

        }

        function connect(agent, host) {
            return new Promise(resolve => {
                agent.createConnection({ host, port: 80 }, err => resolve(err));
            });
        }

        function lookup(agent, hostname, options) {
            return new Promise(resolve => {
                agent.options.lookup(hostname, options, (err, address, family) =>
                    resolve({ err, address, family }));
            });
        }

        beforeEach(() => {
            connected = [];
        });

        it('should keep the options it was given and add a lookup', () => {
            const agent = guard.createSSRFSafeAgent(FakeAgent, { keepAlive: true });

            assert.equal(agent.options.keepAlive, true);
            assert.equal(typeof agent.options.lookup, 'function');
        });

        it('should hand the same lookup to every agent it creates', () => {
            const http = guard.createSSRFSafeAgent(FakeAgent, {});
            const https = guard.createSSRFSafeAgent(FakeAgent, {});

            assert.equal(http.options.lookup, https.options.lookup);
        });

        it('should connect to a public ip literal', async () => {
            const agent = guard.createSSRFSafeAgent(FakeAgent, {});
            const err = await connect(agent, '93.184.216.34');

            assert.equal(err, null);
            assert.deepEqual(connected, [ { host: '93.184.216.34', port: 80 } ]);
        });

        it('should connect to a hostname resolving to a public address', async () => {
            const agent = guard.createSSRFSafeAgent(FakeAgent, {});
            const err = await connect(agent, 'agent-public.test');

            assert.equal(err, null);
            assert.deepEqual(connected, [ { host: 'agent-public.test', port: 80 } ]);
        });

        [ 'loopback.test', 'private.test', '127.0.0.1', '::1', '169.254.169.254', '10.0.0.1' ]
            .forEach(host => {
                it(`should refuse a connection to ${host}`, async () => {
                    const agent = guard.createSSRFSafeAgent(FakeAgent, {});
                    const err = await connect(agent, host);

                    assert.equal(err.code, UNSAFE_TARGET_CODE);
                    assert.equal(connected.length, 0, 'Expected no connection to be opened');
                });
            });

        // createSSRFSafeAgent closes over the module-level isSSRFSafe. If a refactor
        // ever routed it through the exported member instead, overwriting that member
        // would silently disable the transport check.
        it('should enforce via the internal check, not the exported one', async () => {
            const original = ssrf.isSSRFSafe;

            ssrf.isSSRFSafe = async () => true;

            try {
                const agent = ssrf.createSSRFSafeAgent(FakeAgent, {});
                const err = await connect(agent, '127.0.0.1');

                assert.equal(err.code, UNSAFE_TARGET_CODE);
                assert.equal(connected.length, 0, 'Expected no connection to be opened');
            } finally {
                ssrf.isSSRFSafe = original;
            }
        });

        // The same invariant for every other enforcement path: swap the whole export
        // surface for permissive stubs and the real functions, captured first, must
        // still refuse. A call site reading through the export turns one of these red.
        it('should enforce via internal bindings at every entry point', async () => {
            const real = { ...ssrf };
            const isUnsafeTarget = err => !!err && err.code === UNSAFE_TARGET_CODE;

            Object.assign(ssrf, {
                UnsafeTargetError: class Permissive extends Error {},
                isSSRFSafe: async () => true,
                isSSRFSafeURL: async () => true,
                assertSSRFSafe: async () => undefined,
                assertSSRFSafeURL: async () => undefined,
                safeLookup: (hostname, options, cb) => cb(null, '10.11.12.13', 4),
                createSSRFSafeAgent: (Agent, options) => new Agent({ ...options }),
            });

            try {
                assert.equal(await real.isSSRFSafe('127.0.0.1'), false);
                assert.equal(await real.isSSRFSafeURL('http://127.0.0.1/'), false);

                await assert.rejects(real.assertSSRFSafe('10.0.0.1'), isUnsafeTarget);
                await assert.rejects(real.assertSSRFSafeURL('http://127.0.0.1/'), isUnsafeTarget);
                await assert.rejects(real.isSSRFSafeURL('not a url'), isUnsafeTarget);

                const denied = await new Promise(resolve =>
                    real.safeLookup('127.0.0.1', {}, err => resolve(err)));

                assert.equal(isUnsafeTarget(denied), true, 'Expected safeLookup to refuse');

                const agent = real.createSSRFSafeAgent(FakeAgent, {});
                const connectError = await connect(agent, '127.0.0.1');
                const lookupResult = await lookup(agent, 'private.test', { all: true });

                assert.equal(isUnsafeTarget(connectError), true, 'Expected the connect to be refused');
                assert.equal(isUnsafeTarget(lookupResult.err), true, 'Expected the lookup to be refused');
                assert.equal(lookupResult.address, undefined, 'Expected no address to reach the transport');
                assert.equal(connected.length, 0, 'Expected no connection to be opened');
            } finally {
                Object.assign(ssrf, real);
            }
        });

        // net.createConnection returns the socket and calls its second argument as
        // a bare 'connect' listener; http.Agent.createSocket needs the socket either
        // synchronously or as callback(null, socket), never as a connect listener.
        it('should hand the created socket back the way http.Agent takes it', async () => {
            class NetLikeAgent {

                constructor(options) {
                    this.options = options;
                }

                createConnection(connectOptions, callback) {
                    connected.push(connectOptions);

                    if (callback)
                        callback();

                    return { socket: true };
                }

            }

            const agent = guard.createSSRFSafeAgent(NetLikeAgent, {});
            const socket = await new Promise(resolve => {
                const returned = agent.createConnection(
                    { host: '93.184.216.34', port: 80 },
                    (err, s) => resolve(s)
                );

                if (returned)
                    resolve(returned);
            });

            assert.deepEqual(
                socket,
                { socket: true },
                'http.Agent throws on an undefined socket: "Cannot read properties of undefined (reading \'on\')"'
            );
        });

        it('should throw when refusing a connection without a callback', () => {
            const agent = guard.createSSRFSafeAgent(FakeAgent, {});

            assert.throws(
                () => agent.createConnection({ host: '127.0.0.1', port: 80 }),
                err => !(err instanceof UnsafeTargetError) &&
                    /Missing callback in SSRF check/.test(err.message)
            );
            assert.equal(connected.length, 0, 'Expected no connection to be opened');
        });

        describe('lookup', () => {

            it('should hand an approved hostname to the transport', async () => {
                const agent = guard.createSSRFSafeAgent(FakeAgent, {});
                const { err, address, family } = await lookup(agent, 'transport.test', { all: false });

                assert.equal(err, null);
                assert.equal(address, '93.184.216.36');
                assert.equal(family, 4, 'net rejects a lookup callback without a family');
                assert.deepEqual(lookups.map(l => l.hostname), [ 'transport.test' ]);
            });

            it('should return all addresses when asked for all', async () => {
                const agent = guard.createSSRFSafeAgent(FakeAgent, {});
                const { err, address } = await lookup(agent, 'public.test', { all: true });

                assert.equal(err, null);
                assert.deepEqual(address, [ { address: '93.184.216.34', family: 4 } ]);
            });

            it('should check exactly the records it hands to the transport', async () => {
                const agent = guard.createSSRFSafeAgent(FakeAgent, {});
                await lookup(agent, 'all-addresses.test', { all: true });

                assert.deepEqual(lookups.map(l => l.hostname), [ 'all-addresses.test' ]);
                assert.equal(lookups[0].options.all, true);
            });

            it('should refuse a hostname resolving to a private address', async () => {
                const agent = guard.createSSRFSafeAgent(FakeAgent, {});
                const { err, address } = await lookup(agent, 'private.test', { all: true });

                assert.equal(err.code, UNSAFE_TARGET_CODE);
                assert.equal(address, undefined, 'Expected no address to reach the transport');
            });

            it('should refuse a private address on a single-address lookup', async () => {
                const agent = guard.createSSRFSafeAgent(FakeAgent, {});
                const { err, address } = await lookup(agent, 'private-lookup.test', { all: false });

                assert.equal(err.code, UNSAFE_TARGET_CODE);
                assert.equal(address, undefined, 'Expected no address to reach the transport');
            });

            it('should refuse a hostname of which only one address is private', async () => {
                const agent = guard.createSSRFSafeAgent(FakeAgent, {});
                const { err, address } = await lookup(agent, 'mixed-refused.test', { all: true });

                assert.equal(err.code, UNSAFE_TARGET_CODE);
                assert.equal(address, undefined, 'Expected no address to reach the transport');
            });

            it('should surface a dns failure to its callback', async () => {
                const agent = guard.createSSRFSafeAgent(FakeAgent, {});
                const { err } = await lookup(agent, 'temp-failure.test', { all: true });

                assert.equal(err.code, 'EAI_AGAIN');
            });

            // A resolver has to report an unresolvable name, so ENOTFOUND is surfaced
            // here even though isSSRFSafe treats it as safe: it cannot be dialed.
            it('should surface ENOTFOUND to its callback', async () => {
                const agent = guard.createSSRFSafeAgent(FakeAgent, {});
                const { err, address } = await lookup(agent, 'unknown-host.test', { all: true });

                assert.equal(err.code, 'ENOTFOUND');
                assert.equal(address, undefined, 'Expected no address to reach the transport');
            });

        });

    });

    describe('#hostDenylist', () => {

        it('should report a denied host and forget it again when cleared', () => {
            const list = ssrf.hostDenylist;

            assert.equal(list.has('a.test'), false);

            list.deny('a.test');
            assert.equal(list.has('a.test'), true);

            list.clear('a.test');
            assert.equal(list.has('a.test'), false);
        });

        it('should work through an entry handle', () => {
            const entry = ssrf.hostDenylist.entry('a.test');

            entry.deny();
            assert.equal(entry.has(), true);

            entry.clear();
            assert.equal(entry.has(), false);
        });

        it('should not deny a host when denied with state false', () => {
            const list = ssrf.hostDenylist;

            list.deny('a.test', false);
            assert.equal(list.has('a.test'), false);
        });

        // Insertion order is what lets the sweep stop at the first live entry. Asserted
        // on the real clock, where every entry is still within its ttl, so a host
        // reported as absent can only have been evicted by the sweep itself.
        it('should sweep expired entries and stop at the first live one', () => {
            const list = ssrf.hostDenylist;
            const realNow = Date.now;
            let now = realNow();

            Date.now = () => now;

            try {
                list.deny('expired.test');

                now += DENYLIST_TTL / 2;
                list.deny('live.test');

                now += DENYLIST_TTL / 2 + 1;
                list.deny('sweeper.test');
            } finally {
                Date.now = realNow;
            }

            assert.equal(list.has('expired.test'), false, 'Expected the expired head to be evicted');
            assert.equal(list.has('live.test'), true, 'Expected the sweep to stop at the first live entry');
            assert.equal(list.has('sweeper.test'), true);
        });

    });

});
