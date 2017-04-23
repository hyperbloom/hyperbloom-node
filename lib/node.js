'use strict';

const assert = require('assert');
const protocol = require('hyperbloom-protocol');
const BadaBloom = require('badabloom');

const Peer = require('./node/peer');

const DEFAULT_POLL_INTERVAL = 30000;

function Node(options) {
  this.options = Object.assign({
    pollInterval: DEFAULT_POLL_INTERVAL
  }, options);

  this.storage = this.options.storage || new BadaBloom();

  if (this.options.chain)
    this.chain = this.options.chain;
  else if (this.storage.getChain)
    this.chain = this.storage.getChain;
  else
    this.chain = [];

  if (!this.options.feedKey)
    this.options.feedKey = this.storage.getFeedKey();
  if (!this.options.privateKey)
    this.options.privateKey = this.storage.getPrivateKey();

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

Node.prototype.addPeer = function addPeer(remote) {
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

Node.prototype._onPeerError = function _onPeerError(peer, err) {
  // TODO(indutny): log error somewhere
  console.error(err);
};

Node.prototype._onPeerClose = function _onPeerClose(peer) {
  peer.destroy();
  this.peers.delete(peer);
};

Node.prototype._onChainUpdate = function _onChainUpdate(chain) {
  // Use shorter chain for all peers
  if (this.chain.length > chain.length)
    this.chain = chain;

  // Support running on plain badabloom
  if (this.storage.addChain)
    this.storage.addChain(chain);
};

Node.prototype._broadcast = function _broadcast(values, from) {
  this.peers.forEach((peer) => {
    if (peer === from)
      return;

    peer.broadcast(values);
  });
};
