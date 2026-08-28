# URL extensions

[![CircleCI](https://circleci.com/gh/ambassify/url-extensions.svg?style=svg)](https://circleci.com/gh/ambassify/url-extensions)

Extensions to the nodejs url package.

## Installation

```shell
npm install --save @ambassify/url-extensions
```

## Usage

```javascript
const URL = require('@ambassify/url-extensions');

// https://www.google.com?hello=world
URL.query.add('https://www.google.com', { hello: 'world' });

// https://www.google.com?hello=world
URL.query.omit('https://www.google.com?a=test&hello=world', ['a']);
URL.query.remove('https://www.google.com?a=test&hello=world', ['a']);

// hello=world&foo=bar
URL.query.build({ hello: 'world', foo: 'bar' });
URL.query.rebuild({ hello: 'world', foo: 'bar' });

// { hello: 'world' }
URL.query.parse('https://www.google.com/?hello=world');

// https://www.google.com/foo/bar
URL.path.concat('https://www.google.com', 'foo', 'bar');
```

### SSRF guard

`@ambassify/url-extensions/ssrf` classifies a target host before you connect to
it, so a user-supplied url cannot be pointed at loopback, link-local, private,
or otherwise internal address space. It is a separate entry point because it
needs `dns` and is asynchronous — requiring the package root stays sync and
dependency-free.

```javascript
const ssrf = require('@ambassify/url-extensions/ssrf');
const { assertSSRFSafeURL, createSSRFSafeAgent } = ssrf;

// Throws UnsafeTargetError on anything but a public http(s) target
await assertSSRFSafeURL(req.query.url);

// Re-checks on every connect and every dns lookup, so a redirect or a
// rebinding response cannot slip past the up-front check above.
const agent = createSSRFSafeAgent(require('https').Agent, { keepAlive: true });
```

Checking the url up front is not enough on its own: redirects and DNS rebinding
resolve after the check. Use the agent for the actual transport, and re-check
every redirect target you follow.

#### API

- `isSSRFSafe(hostname, [{ dnsRecords }])` — resolves to `true`/`false`. An ip
  literal is classified without a dns lookup; `dnsRecords` lets you classify
  records you already resolved. A hostname that does not resolve is reported as
  safe, since there is nothing to connect to.
- `isSSRFSafeURL(url, [base])` — as above, but parses `url` (relative to `base`)
  and refuses any protocol outside `http:`/`https:`. Throws
  `UnsafeTargetError` when `url` cannot be parsed.
- `assertSSRFSafe(hostname, [options])` / `assertSSRFSafeURL(url, [base])` — the
  same checks, throwing `UnsafeTargetError` instead of returning `false`.
- `createSSRFSafeAgent(Agent, options)` — wraps an `http.Agent`-like class so
  both its dns lookups and its connects are checked.
- `safeLookup(hostname, options, callback)` — the checked `dns.lookup`
  drop-in that `createSSRFSafeAgent` installs, for agents you build yourself.
- `hostDenylist` — refused hostnames are cached for 60s to keep a hammered
  target from re-resolving; `deny`, `clear`, `has` and `entry` are exposed.
  The cache is process-wide, so a `deny` or `clear` on it applies everywhere.
- `UnsafeTargetError` — the error thrown by the `assert*` calls, with
  `code === 'UnsafeTargetError'`.

Requires Node 10 or newer.

## Contributing

If you have some issue or code you would like to add, feel free to open a Pull Request or Issue and we will look into it as soon as we can.

## License

We are releasing this under a MIT License.

## About us

If you would like to know more about us, be sure to have a look at [our website](https://www.ambassify.com), or our Twitter accounts [@Ambassify](https://twitter.com/Ambassify), [Sitebase](https://twitter.com/Sitebase), [JorgenEvens](https://twitter.com/JorgenEvens)
