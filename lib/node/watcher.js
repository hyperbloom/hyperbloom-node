'use strict';

const util = require('util');
const EventEmitter = require('events').EventEmitter;
const BadaBloom = require('badabloom');

function Watcher(range) {
  EventEmitter.call(this);

  this.range = range;
}
util.inherits(Watcher, EventEmitter);
module.exports = Watcher;

Watcher.prototype._isMatch = function _isMatch(value) {
  if (BadaBloom.compare(value, this.range.start) < 0)
    return false;

  if (this.range.end && BadaBloom.compare(value, this.range.end) >= 0)
    return false;

  return true;
};

Watcher.prototype.push = function push(values) {
  const filtered = values.filter(value => this._isMatch(value));

  process.nextTick(() => {
    this.emit('values', filtered);
  });
};
