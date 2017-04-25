'use strict';

const assert = require('assert');
const debug = require('debug')('hyperbloom:node');
const protocol = require('hyperbloom-protocol');
const BadaBloom = require('badabloom');
const Buffer = require('buffer').Buffer;

const Peer = require('./node/peer');
const Watcher = require('./node/watcher');

function Node(options) {
  this.options = Object.assign({
    full: true
  }, options);

  assert(Buffer.isBuffer(this.options.feedKey),
         '`options.feedKey` must be a Buffer');
  assert(Buffer.isBuffer(this.options.privateKey),
         '`options.privateKey` must be a Buffer');

  this.storage = this.options.storage || new BadaBloom();
  this.trust = this.options.trust;

  this.chain = this.options.chain || [];

  this.peers = new Set();
  this.watchers = new Set();
}
module.exports = Node;

// Mostly for testing
Node.Peer = Peer;
Node.Watcher = Watcher;

Node.prototype.close = function close() {
  this.peers.forEach((peer) => {
    if (peer.shutdown)
      peer.shutdown();
    else
      peer.destroy();
  });
};

// Asynchronous fetching

Node.prototype.watch = function watch(range) {
  const w = new Watcher(range);

  const existing = this.request(range);
  this.watchers.add(w);

  this.peers.forEach((peer) => {
    if (!this.options.full)
      peer.request(range);
  });

  w.push(existing);

  return w;
};

Node.prototype.unwatch = function unwatch(watcher) {
  this.watchers.delete(watcher);
};

// Storage access

Node.prototype.request = function request(range, limit) {
  return this.storage.request(range, limit);
};

Node.prototype.has = function has(value) {
  return this.storage.has(value);
};

Node.prototype.insert = function insert(value, callback) {
  return this.bulkInsert([ value ], callback).length !== 0;
};

Node.prototype.bulkInsert = function bulkInsert(values, callback) {
  const inserted = this.storage.bulkInsert(values);
  if (inserted.length !== 0)
    this._broadcast(inserted, null, callback);
  else if (callback)
    process.nextTick(callback, null, inserted);
  return inserted;
};

// Peers

Node.prototype.addStream = function addStream(stream) {
  debug('new peer');

  stream.on('secure', () => {
    debug('peer secure');
  });

  // TODO(indutny): reuse `discoveryKey`
  stream.start({
    feedKey: this.options.feedKey,
    privateKey: this.options.privateKey,
    chain: this.chain
  });

  const peer = new Peer(stream, {
    full: this.options.full,
    feedKey: this.options.feedKey,
    storage: this.storage,
    trust: this.trust,
    pollInterval: this.options.pollInterval
  });

  stream.once('close', () => this._onPeerClose(peer));
  stream.on('chain-update', chain => this._onChainUpdate(chain));

  this.peers.add(peer);

  peer.on('values', (values) => {
    debug('peer broadcasts');
    this._broadcast(values, peer);
  });

  this.watchers.forEach((watcher) => {
    if (!this.options.full)
      peer.request(watcher.range);
  });
};

// Private

Node.prototype._onPeerError = function _onPeerError(peer, err) {
  debug('peer err=%s stack=%s', err.message, err.stack);
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

Node.prototype._broadcast = function _broadcast(values, from, callback) {
  let waiting = 0;
  const done = () => {
    if (!callback)
      return;

    if (--waiting === 0)
      return callback(null, values);
  };
  this.peers.forEach((peer) => {
    if (peer === from)
      return;

    waiting++;
    peer.broadcast(values, done);
  });
  this.watchers.forEach((watcher) => {
    watcher.push(values);
  });
};
