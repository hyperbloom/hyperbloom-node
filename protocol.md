# Protocol

Messages are sent between peers. Each message consists of:

- binary header (protobuf `varint` encoding of message id)
- protobuf encoding of the message

`Open` has the same id as `Handshake`, this is intentional. Connection state
MUST be used to distinguish between these two messages.

## 0 Open

**The only unencrypted message**

```
message Open {
  required bytes feed = 1;
  required bytes nonce = 2;
}
```

- `feed` - discovery key of HyperCore Ledger
- `nonce` - random 24-byte nonce

Sent at the connection start by both sides.

## 0 Handshake

Similar to HyperCore

```
message Handshake {
  required bytes id = 1;
  repeated string extensions = 2;
  repeated bytes chain = 3;
}
```

- `id` - peer id
- `extensions`
- `chain` - signature chain with the root verifiable by HyperCore Ledger's
            public key. See `Signature Chain` below

Sent after `Open` and is used to verify trust relationship between
peers.

## 1 Query

```
message Sync {
  required bytes filter = 1;
  required uint32 size = 2;
  required uint32 n = 3;
  required uint32 seed = 4;
  optional uint32 limit = 5;
}
```

- `filter` - byte array with the contents of Bloom Filter
- `size` - Bloom Filter's bit size
- `n` - Number of hash functions in Bloom Filter
- `seed` - seed value for the Bloom Filter's hash function

The Bloom Filter in the message contains all key + value pairs
currently known to the peer. Upon receipt the peer MUST validate the
parameters (`filter.length * 8 >= size >= (filter.length - 1) * 8`). The peer
MAY discard the message and MAY close the connection if the Filter size exceeds
its capabilities.

After successful validation peer MAY send `Data` messages.

If `limit` is present - the number of sent values for this query SHOULD not
exceed `limit`.

`extensions` are reserved for future use.

## 2 FilterOptions

```
message FilterOptions {
  required uint32 size = 1;
  required uint32 n = 1;
}
```

MAY be sent at any time by peer to notify other side about recommended Bloom
Filter size and options. Sending peer SHOULD accept filters with size less or
equal to specified `size`. Upon receiving `Query` message with
unsupported filter size, peer SHOULD send `FilterOptions` with recommended
values.

## 3 Data

```
message Data {
  repeated bytes values = 1;
}
```

- `values` - list of byte arrays, MUST not be empty. `values` MUST not contain
   duplicates. Each element of the list MUST not be empty.

## 4 Request

```
message Request {
  required bytes start  = 1;
  required bytes end = 2;
  optional uint32 limit = 3;
}
```

MAY be sent by peer to selectively request values in specified range. Resulting
`Data` message if present SHOULD contain values which are lexicographically
greater or equal than `start` and lexicographically less than `end`.

If `limit` is present - the number of sent values for this query SHOULD not
exceed `limit`.

## Signature Chain

HyperBloom allows write only from the Trust Network of the HyperCore ledger's
author. The permissions are given by signing the SHA-256 hash of the following
structure with the private key of someone who is already in the Trust Network:

- `version` - 1 for now
- `public key` - trustee's public key
- `nonce` - 32-byte nonce

Together signature and this structure make a **Trust Link**:

- `version`
- `public key`
- `nonce`
- `signature`

A `token` (which is used in `Handshake`) consists of **5 Token Links or less**.
First Trust Link MUST be signed with the HyperCore Ledger's private key. Each
subsequent Trust Links MUST be signed by the private key corresponding to the
public key in the previous Trust Link.

Given that everyone subscribed to the HyperCore Ledger know author's public key,
such Signature Chain can be easily validated by all peers. Trust Links are
stored in auxiliary structure not covered by this document.

NOTE: HyperCore Ledger's author has just one Trust Link, signing their own
public key.

## Bloom Filter

Bloom Filter is used to efficiently find deltas between two peers. Each Bloom
Filter MUST use [Murmur3_32][0] as a hash function's algorithm. The detailed
hash algorithm is below:

```js
function hash(val /* byte array */,
              seed /* uint32 random */,
              i /* index of hash function, 0 <= i < N */) {
  return murmur(val, sum32(mul32(i, 0xfa68676f), seed));
}
```

Data added to the Bloom Filter is just the values that are stored in HyperBloom.

NOTE: 0xfa68676f is a prime number and first 4 bytes of SHA-256 digest of
following ASCII input: "hyperbloom/random_string/f53d6d58".

[0]: https://en.wikipedia.org/wiki/MurmurHash