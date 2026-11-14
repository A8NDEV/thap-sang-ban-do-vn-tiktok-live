import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shareAllowed } from '../src/domain/share-rule.mjs';

test('shareAllowed: no previous share is allowed', () => {
  assert.equal(shareAllowed(undefined, 1000), true);
  assert.equal(shareAllowed(null, 1000), true);
  assert.equal(shareAllowed(NaN, 1000), true);
});

test('shareAllowed: default gap is 5 minutes, boundary inclusive', () => {
  const last = 1_000_000;
  assert.equal(shareAllowed(last, last + 299_999), false);
  assert.equal(shareAllowed(last, last + 300_000), true);
  assert.equal(shareAllowed(last, last + 300_001), true);
  assert.equal(shareAllowed(last, last), false);
  assert.equal(shareAllowed(last, last + 1), false);
});

test('shareAllowed: custom gap', () => {
  assert.equal(shareAllowed(100, 1099, 1000), false);
  assert.equal(shareAllowed(100, 1100, 1000), true);
  assert.equal(shareAllowed(100, 100, 0), true);
});

test('shareAllowed: clock going backwards is rejected', () => {
  assert.equal(shareAllowed(5000, 4999), false);
  assert.equal(shareAllowed(5000, 1), false);
  assert.equal(shareAllowed(5000, 4999, 0), false);
});

test('shareAllowed: non-finite now is rejected', () => {
  assert.equal(shareAllowed(1000, NaN), false);
  assert.equal(shareAllowed(1000, undefined), false);
  assert.equal(shareAllowed(undefined, NaN), false);
});
