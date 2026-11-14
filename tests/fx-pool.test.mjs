import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../public/js/overlay/fx-pool.js';

test('add returns false at cap', () => {
  const pool = createPool(10);
  pool.setCap(3);
  assert.equal(pool.add(() => {}), true);
  assert.equal(pool.add(() => {}), true);
  assert.equal(pool.add(() => {}), true);
  assert.equal(pool.add(() => {}), false);
  assert.equal(pool.count, 3);
});

test('freed particles are reused', () => {
  const max = 4;
  const pool = createPool(max);
  const seen = new Set();
  const collect = (p) => { seen.add(p); };
  for (let i = 0; i < max; i++) pool.add(() => {});
  pool.forEach((p) => { seen.add(p); });
  pool.forEach(() => false);
  assert.equal(pool.count, 0);
  for (let round = 0; round < 5; round++) {
    for (let i = 0; i < max; i++) assert.equal(pool.add(collect), true);
    pool.forEach((p) => { seen.add(p); });
    pool.forEach(() => false);
    assert.equal(pool.count, 0);
  }
  assert.ok(seen.size <= max);
});

test('lowering cap keeps live particles but refuses new ones', () => {
  const pool = createPool(10);
  for (let i = 0; i < 5; i++) assert.equal(pool.add(() => {}), true);
  pool.setCap(2);
  assert.equal(pool.count, 5);
  assert.equal(pool.add(() => {}), false);
  // free 3 -> count 2, still not below cap
  let n = 0;
  pool.forEach(() => (n++ < 3 ? false : undefined));
  assert.equal(pool.count, 2);
  assert.equal(pool.add(() => {}), false);
  // free 1 more -> count 1 < cap 2
  let m = 0;
  pool.forEach(() => (m++ < 1 ? false : undefined));
  assert.equal(pool.count, 1);
  assert.equal(pool.add(() => {}), true);
  assert.equal(pool.count, 2);
  assert.equal(pool.add(() => {}), false);
});

test('setCap clamps to [0, max]', () => {
  const pool = createPool(900);
  pool.setCap(10_000);
  assert.equal(pool.cap(), 900);
  pool.setCap(-1);
  assert.equal(pool.cap(), 0);
  assert.equal(pool.add(() => {}), false);
});

test('setCap ignores non-finite values', () => {
  const pool = createPool(50);
  pool.setCap(20);
  pool.setCap(NaN);
  assert.equal(pool.cap(), 20);
  pool.setCap(Infinity);
  assert.equal(pool.cap(), 20);
  pool.setCap(undefined);
  assert.equal(pool.cap(), 20);
});

test('thousands of requests never exceed cap', () => {
  const pool = createPool(1000);
  pool.setCap(900);
  let accepted = 0;
  for (let i = 0; i < 5000; i++) if (pool.add(() => {})) accepted++;
  assert.equal(pool.count, 900);
  assert.equal(accepted, 900);
});

test('forEach tolerates freeing during iteration', () => {
  const pool = createPool(20);
  for (let i = 0; i < 10; i++) pool.add((p) => { p.x = i; });
  const visited = [];
  pool.forEach((p) => {
    visited.push(p.x);
    return p.x % 3 === 0 ? false : undefined;
  });
  // every particle visited exactly once, none skipped
  assert.deepEqual([...visited].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  // 0,3,6,9 freed
  assert.equal(pool.count, 6);
  const rest = [];
  pool.forEach((p) => { rest.push(p.x); });
  assert.deepEqual(rest.sort((a, b) => a - b), [1, 2, 4, 5, 7, 8]);
});

test('only exactly false frees a particle', () => {
  const pool = createPool(5);
  for (let i = 0; i < 3; i++) pool.add(() => {});
  pool.forEach(() => undefined);
  pool.forEach(() => 0);
  pool.forEach(() => null);
  pool.forEach(() => true);
  assert.equal(pool.count, 3);
});

test('reused particles are reset to defaults before init', () => {
  const pool = createPool(1);
  pool.add((p) => {
    p.x = 5; p.y = 6; p.px = 7; p.py = 8; p.vx = 9; p.vy = 10;
    p.alpha = 0.2; p.decay = 0.5; p.size = 4; p.gravity = 3; p.drag = 0.9;
    p.color = '#f00'; p.spark = true;
  });
  pool.forEach(() => false);
  let seenByInit;
  pool.add((p) => { seenByInit = { ...p }; p.x = 1; });
  assert.deepEqual(seenByInit, {
    x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0,
    alpha: 1, decay: 0, size: 1, gravity: 0, drag: 1, color: '', spark: false,
  });
  pool.forEach((p) => {
    assert.equal(p.x, 1);
    assert.equal(p.alpha, 1);
    assert.equal(p.spark, false);
    assert.equal(p.color, '');
  });
});
