# HyperBloom Node

[HyperBloom][0] protocol node.

## Usage

```js
const HyperNode = require('hyperbloom-node');

const node = new HyperNode({
  full: true,  // sync whole HyperBloom set
  feedKey: feedKey,
  privateKey: privateKey,

  storage: storage,  // optional, see `hyperbloom-value-storage` npm module
  trust: trust,  // optional, see `hyperbloom-trust` npm module

  chain: []  // optional, trust chain from `feedKey` to `privateKey`
});

// Connect streams together

const stream = createStream();  // see `hyperbloom-protocol` npm module
node.addStream(stream);

// Watch values

const w = node.watch({
  start: Buffer.from('a'),
  end: Buffer.from('z')
});

w.on('values', (values) => {
  console.log(values);
});

node.unwatch(w);

// Request/Insert values

// NOTE: `values` are emitted only in watcher
node.request({
  start: Buffer.from('a'),
  end: Buffer.from('z')
}, optionalLimitNum);

node.has(Buffer.from('a'));

node.insert(Buffer.from('value'));
node.bulkInsert([ Buffer.from('value') ]);
```

## LICENSE

This software is licensed under the MIT License.

Copyright Fedor Indutny, 2017.

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the
following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
USE OR OTHER DEALINGS IN THE SOFTWARE.

[0]: https://github.com/hyperbloom/hyperbloom
