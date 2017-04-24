'use strict';

const util = require('util');
const debug = require('debug')('hyperbloom:peer');
const EventEmitter = require('events').EventEmitter;

function Peer(stream, options) {
  EventEmitter.call(this);

  this.feedKey = options.feedKey;
  this.storage = options.storage;
  this.trust = options.trust;

  // If `true` - sync all data, if `false` - only work in request/publish mode
  this.isFull = options.full;

  this.stream = stream;

  this.stream.on('message', ({ type, body }) => this.handle(type, body));
  this.stream.on('secure', ({ chain }) => this.onRemoteChain(chain));

  if (this.isFull)
    this.poll();
}
util.inherits(Peer, EventEmitter);
module.exports = Peer;

Peer.prototype.request = function request(range, limit) {
  this.stream.request({ start: range.start, end: range.end, limit });
};

Peer.prototype.handle = function handle(type, body) {
  debug('got message type=%s', type);
  if (type === 'sync')
    this.onSync(body);
  else if (type === 'filter-options')
    this.onFilterOptions(body);
  else if (type === 'data')
    this.onData(body.values);
  else if (type === 'request')
    this.onRequest(body);
};

Peer.prototype.onSync = function onSync(body) {
  const values = this.storage.sync({
    filter: body.filter,
    size: body.size,
    n: body.n,
    seed: body.seed
  }, body.range, body.limit);
  if (values.length === 0)
    return;

  debug('sync result=%d', values.length);
  this.stream.data({ values });
};

Peer.prototype.onFilterOptions = function onFilterOptions(body) {
  // TODO(indutny): use `body`
};

Peer.prototype.onData = function onData(values) {
  const inserted = this.storage.bulkInsert(values);
  if (inserted.length !== 0)
    this.emit('values', inserted);
};

Peer.prototype.onRequest = function onRequest(body) {
  const values = this.storage.request({
    start: body.start,
    end: body.end
  }, body.limit);
  if (values.length !== 0)
    this.stream.data({ values });
};

Peer.prototype.onRemoteChain = function onRemoteChain(chain) {
  if (this.trust)
    this.trust.addChain(this.feedKey, chain);
};

Peer.prototype.broadcast = function broadcast(values) {
  // TODO(indutny): this may be unoptimal at times as remote end may know
  // these values already
  if (values.length !== 0)
    this.stream.data({ values });
};

Peer.prototype.poll = function poll() {
  // TODO(indutny): split filter if it is too large and sync keys
  // separately
  const raw = this.storage.getRawFilter();

  this.stream.sync({
    filter: raw.filter,
    size: raw.size,
    n: raw.n,
    seed: raw.seed,
    range: null,

    // TODO(indutny): use limit?
    limit: 0
  });
};

Peer.prototype.destroy = function destroy() {
};
