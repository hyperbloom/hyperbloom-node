'use strict';

const assert = require('assert');
const signatures = require('sodium-signatures');
const streamPair = require('stream-pair');

const Node = require('../');

describe('hyperbloom-node', () => {
  const root = signatures.keyPair();

  it('should synchronize two instances on connection', (cb) => {
    const a = new Node({
      feedKey: root.publicKey,
      privateKey: root.secretKey
    });

    a.insert(Buffer.from('hello'));
    a.insert(Buffer.from('world'));

    const b = new Node({
      feedKey: root.publicKey,
      privateKey: root.secretKey
    });

    b.insert(Buffer.from('ohai'));
    b.insert(Buffer.from('world'));

    const pair = streamPair.create();
    pair.destroy = () => { throw new Error('Unexpected') };
    pair.other.destroy = () => { throw new Error('Unexpected') };

    a.addPeer(pair);
    b.addPeer(pair.other);

    setTimeout(() => {
      assert(a.has(Buffer.from('ohai')));
      assert(b.has(Buffer.from('hello')));
      cb();
    }, 100);
  });

  it('should synchronize full with partial nodes', (cb) => {
    const a = new Node({
      feedKey: root.publicKey,
      privateKey: root.secretKey
    });

    a.insert(Buffer.from('hello'));
    a.insert(Buffer.from('holy'));
    a.insert(Buffer.from('world'));

    const b = new Node({
      full: false,
      feedKey: root.publicKey,
      privateKey: root.secretKey
    });

    const pair = streamPair.create();
    pair.destroy = () => { throw new Error('Unexpected') };
    pair.other.destroy = () => { throw new Error('Unexpected') };

    const w = b.watch({ start: Buffer.from('h'), end: Buffer.from('i') });
    let got = [];
    w.on('values', (values) => {
      got = got.concat(values);
      if (got.length === 2) {
        const sorted = got.map(x => x.toString()).sort();
        assert.deepEqual(sorted, [ 'hello', 'holy' ]);
        b.unwatch(w);
        cb();
      }
    });

    a.addPeer(pair);
    b.addPeer(pair.other);
  });
});
