'use strict';

const assert = require('assert');
const signatures = require('sodium-signatures');
const streamPair = require('stream-pair');

const HyperBloom = require('../');

describe('HyperBloom', () => {
  const root = signatures.keyPair();

  it('should synchronize two instances on connection', (cb) => {
    const a = new HyperBloom({
      feedKey: root.publicKey,
      privateKey: root.secretKey,
      chain: []
    });

    a.insert(Buffer.from('hello'));
    a.insert(Buffer.from('world'));

    const b = new HyperBloom({
      feedKey: root.publicKey,
      privateKey: root.secretKey,
      chain: []
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
});
