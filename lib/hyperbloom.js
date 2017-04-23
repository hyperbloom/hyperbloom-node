'use strict';

const assert = require('assert');
const protocol = require('hyperbloom-protocol');
const BadaBloom = require('badabloom');

const Peer = require('./hyperbloom/peer');

const DEFAULT_POLL_INTERVAL = 30000;

function HyperBloom(options) {
  assert.equal(typeof options, 'object', '`options` is a required argument');
  assert(Buffer.isBuffer(options.feedKey),
         '`options.feedKey` must be a Buffer');
  assert(Buffer.isBuffer(options.privateKey),
         '`options.privateKey` must be a Buffer');
  assert(Array.isArray(options.chain), '`options.chain` must be an Array');

  this.options = Object.assign({
    pollInterval: DEFAULT_POLL_INTERVAL
  }, options);

  this.chain = this.options.chain;
  this.storage = this.options.storage || new BadaBloom();
  this.bloom = new BadaBloom(this.options.bloom);

  this.peers = new Set();
}
module.exports = HyperBloom;

// Mostly testing
HyperBloom.Peer = Peer;

// Storage access
//
HyperBloom.prototype.request = function request(range, limit) {
  return this.storage.request(range, limit);
};

HyperBloom.prototype.has = function has(value) {
  return this.storage.has(value);
};

HyperBloom.prototype.insert = function insert(value) {
  return this.bulkInsert([ value ]).length !== 0;
};

HyperBloom.prototype.bulkInsert = function bulkInsert(values) {
  const inserted = this.storage.bulkInsert(values);
  if (inserted.length !== 0)
    this._broadcast(inserted);
  return inserted;
};

// Peers

HyperBloom.prototype.addPeer = function addPeer(remote) {
  // TODO(indutny): reuse `discoveryKey`
  const stream = new protocol.Stream({
    feedKey: this.options.feedKey,
    privateKey: this.options.privateKey,
    chain: this.chain
  });

  const onClose = () => {
    this._onPeerClose(stream);
  };

  stream.once('close', onClose);
  remote.once('close', onClose);

  const onError = (err) => {
    remote.destroy();
    this._onPeerError(stream, err);
  }

  stream.once('error', onError);
  remote.once('error', onError);

  stream.pipe(remote);
  remote.pipe(stream);

  stream.on('chain-update', chain => this._onChainUpdate(chain));

  const peer = new Peer(stream, remote, {
    storage: this.storage,
    pollInterval: this.options.pollInterval
  });
  this.peers.add(peer);

  peer.on('values', (values) => {
    this._broadcast(values, peer);
  });
};

// Private

HyperBloom.prototype._onPeerError = function _onPeerError(peer, err) {
  // TODO(indutny): log error somewhere
  console.error(err);
};

HyperBloom.prototype._onPeerClose = function _onPeerClose(peer) {
  peer.destroy();
  this.peers.delete(peer);
};

HyperBloom.prototype._onChainUpdate = function _onChainUpdate(chain) {
  // Use shorter chain for all peers
  if (this.chain.length > chain.length)
    this.chain = chain;

  // Support running on plain badabloom
  if (this.storage.addChain)
    this.storage.addChain(chain);
};

HyperBloom.prototype._broadcast = function _broadcast(values, from) {
  this.peers.forEach((peer) => {
    if (peer === from)
      return;

    peer.broadcast(values);
  });
};
