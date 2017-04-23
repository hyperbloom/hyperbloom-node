'use strict';

const assert = require('assert');
const debug = require('debug')('hyperbloom:node');
const protocol = require('hyperbloom-protocol');
const BadaBloom = require('badabloom');
const Buffer = require('buffer').Buffer;

const Peer = require('./node/peer');

function Node(options) {
  this.options = Object.assign({
  }, options);

  assert(Buffer.isBuffer(this.options.feedKey),
         '`options.feedKey` must be a Buffer');
  assert(Buffer.isBuffer(this.options.privateKey),
         '`options.privateKey` must be a Buffer');

  this.storage = this.options.storage || new BadaBloom();
  this.trust = this.options.trust;

  this.chain = this.options.chain || [];

  this.peers = new Set();
}
module.exports = Node;

// Mostly testing
Node.Peer = Peer;

// Storage access
//
Node.prototype.request = function request(range, limit) {
  return this.storage.request(range, limit);
};

Node.prototype.has = function has(value) {
  return this.storage.has(value);
};

Node.prototype.insert = function insert(value) {
  return this.bulkInsert([ value ]).length !== 0;
};

Node.prototype.bulkInsert = function bulkInsert(values) {
  const inserted = this.storage.bulkInsert(values);
  if (inserted.length !== 0)
    this._broadcast(inserted);
  return inserted;
};

// Peers

Node.prototype.addPeer = function addPeer(remote, preparse) {
  debug('new peer preparse=%d', !!preparse);

  // TODO(indutny): reuse `discoveryKey`
  const stream = new protocol.Stream({
    feedKey: this.options.feedKey,
    privateKey: this.options.privateKey,
    chain: this.chain,
    preparse
  });

  stream.on('secure', () => {
    debug('peer secure');
  });

  let peer;

  const onClose = () => {
    this._onPeerClose(peer);
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

  peer = new Peer(stream, remote, {
    feedKey: this.options.feedKey,
    storage: this.storage,
    trust: this.trust,
    pollInterval: this.options.pollInterval
  });
  this.peers.add(peer);

  peer.on('values', (values) => {
    debug('peer broadcasts');
    this._broadcast(values, peer);
  });
};

// Private

Node.prototype._onPeerError = function _onPeerError(peer, err) {
  debug('peer err=%s', err.message);
};

Node.prototype._onPeerClose = function _onPeerClose(peer) {
  peer.destroy();
  this.peers.delete(peer);
};

Node.prototype._onChainUpdate = function _onChainUpdate(chain) {
  // Use shorter chain for all peers
  if (this.chain.length > chain.length)
    this.chain = chain;

  if (this.trust)
    this.trust.addChain(this.options.feedKey, chain);
};

Node.prototype._broadcast = function _broadcast(values, from) {
  this.peers.forEach((peer) => {
    if (peer === from)
      return;

    peer.broadcast(values);
  });
};
