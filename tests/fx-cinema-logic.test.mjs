import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  giftTier,
  createBudget,
  lanternCount,
  LANTERN_MAX,
} from '../public/js/overlay/fx-cinema-logic.js';

test('giftTier boundaries', () => {
  assert.equal(giftTier(0), 0);
  assert.equal(giftTier(29), 0);
  assert.equal(giftTier(30), 1);
  assert.equal(giftTier(99), 1);
  assert.equal(giftTier(100), 2);
  assert.equal(giftTier(999), 2);
  assert.equal(giftTier(1000), 3);
});

test('giftTier rejects non-finite, non-positive and non-number input', () => {
  assert.equal(giftTier(NaN), 0);
  assert.equal(giftTier(-5), 0);
  assert.equal(giftTier(undefined), 0);
  assert.equal(giftTier('100'), 0);
  assert.equal(giftTier(Infinity), 0);
});

test('createBudget caps acquisitions', () => {
  const b = createBudget(2);
  assert.equal(b.tryAcquire(), true);
  assert.equal(b.tryAcquire(), true);
  assert.equal(b.tryAcquire(), false);
  assert.equal(b.active, 2);
});

test('createBudget release frees a slot', () => {
  const b = createBudget(2);
  b.tryAcquire();
  b.tryAcquire();
  b.release();
  assert.equal(b.active, 1);
  assert.equal(b.tryAcquire(), true);
  assert.equal(b.active, 2);
});

test('createBudget release never goes negative', () => {
  const b = createBudget(2);
  b.tryAcquire();
  b.release(5);
  assert.equal(b.active, 0);
  b.release();
  assert.equal(b.active, 0);
});

test('createBudget tryAcquire(n) larger than remaining fails without change', () => {
  const b = createBudget(2);
  assert.equal(b.tryAcquire(3), false);
  assert.equal(b.active, 0);
  b.tryAcquire();
  assert.equal(b.tryAcquire(2), false);
  assert.equal(b.active, 1);
});

test('createBudget(24) holds at 24 after 5000 acquisitions', () => {
  const b = createBudget(LANTERN_MAX);
  for (let i = 0; i < 5000; i++) b.tryAcquire();
  assert.equal(b.active, 24);
});

test('lanternCount by quality and freshness', () => {
  assert.equal(LANTERN_MAX, 24);
  assert.equal(lanternCount(0, true), 6);
  assert.equal(lanternCount(1, true), 3);
  assert.equal(lanternCount(2, true), 0);
  assert.equal(lanternCount(0, false), 0);
});
