'use strict';

const assert = require('assert');
const BadaBloom = require('badabloom');

function HyperBloom(options) {
  assert.equal(typeof options, 'object', '`options` is a required argument');

  this.options = options;

  assert.equal(typeof this.options.verify, 'function',
               '`options.verify` must be a function');

  this.verify = this.options.verify;
  this.bloom = new BadaBloom(this.options.bloom);
}
module.exports = HyperBloom;

HyperBloom.prototype._hash = function _hash(value) {
  return crypto.createHash(this.options.hash).update(value).digest();
};

HyperBloom.prototype.execute = function execute(cmd) {
  if (cmd.type === 'fetch')
    return this.bloom.fetch(cmd.key);
  else if (cmd.type === 'insert')
    return this.bloom.insert(cmd.key, cmd.value);
  else if (cmd.type === 'count')
    return this.bloom.getCount();
  else if (cmd.type === 'query')
    return this.bloom.query(cmd.bloom);
};
