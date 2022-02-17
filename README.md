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

## Contributing

If you have some issue or code you would like to add, feel free to open a Pull Request or Issue and we will look into it as soon as we can.

## License

We are releasing this under a MIT License.

## About us

If you would like to know more about us, be sure to have a look at [our website](https://www.ambassify.com), or our Twitter accounts [@Ambassify](https://twitter.com/Ambassify), [Sitebase](https://twitter.com/Sitebase), [JorgenEvens](https://twitter.com/JorgenEvens)
