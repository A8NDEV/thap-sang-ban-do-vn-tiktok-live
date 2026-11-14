import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVEL_NAMES, DEFAULT_TIERS, parseTiers, levelOf, nextInfo } from '../src/domain/levels.mjs';

const T = DEFAULT_TIERS;

test('constants', () => {
  assert.deepEqual(LEVEL_NAMES, ['', 'Đồng', 'Bạc', 'Vàng', 'Kim cương']);
  assert.deepEqual(DEFAULT_TIERS, [10, 100, 500, 2000]);
});

test('parseTiers accepts four increasing positive numbers', () => {
  assert.deepEqual(parseTiers('10,100,500,2000'), [10, 100, 500, 2000]);
  assert.deepEqual(parseTiers(' 5 , 50 ,  300,1000 '), [5, 50, 300, 1000]);
  assert.deepEqual(parseTiers('1,2,3,4'), [1, 2, 3, 4]);
});

test('parseTiers falls back to defaults on bad input', () => {
  const bad = [
    '', 'abc', '10,100,500', '10,100,500,2000,5000', '10,100,500,x',
    '10,,500,2000', '10,100,100,2000', '2000,500,100,10', '0,100,500,2000',
    '-5,100,500,2000', '10,100,500,NaN', '10,100,500,Infinity', '10;100;500;2000',
    null, undefined, 42, [10, 100, 500, 2000], {},
  ];
  for (const b of bad) assert.deepEqual(parseTiers(b), DEFAULT_TIERS, `input: ${String(b)}`);
});

test('parseTiers returns a fresh array, not the shared default', () => {
  const a = parseTiers('nope');
  a[0] = 999;
  assert.deepEqual(DEFAULT_TIERS, [10, 100, 500, 2000]);
  assert.deepEqual(parseTiers('nope'), [10, 100, 500, 2000]);
});

test('levelOf boundaries', () => {
  const cases = [
    [0, 0], [9, 0], [10, 1], [99, 1], [100, 2], [499, 2],
    [500, 3], [1999, 3], [2000, 4], [999999, 4],
  ];
  for (const [coins, lv] of cases) assert.equal(levelOf(coins, T), lv, `coins=${coins}`);
});

test('levelOf invalid coins gives 0', () => {
  for (const c of [-1, -100, NaN, Infinity, undefined, null, '500', {}, [] ]) {
    assert.equal(levelOf(c, T), 0, `coins=${String(c)}`);
  }
});

test('levelOf works with custom tiers and tolerates bad tiers', () => {
  assert.equal(levelOf(5, [5, 6, 7, 8]), 1);
  assert.equal(levelOf(8, [5, 6, 7, 8]), 4);
  assert.equal(levelOf(100, undefined), 2);
  assert.equal(levelOf(100, [1, 2]), 2);
});

test('nextInfo at level 0', () => {
  assert.deepEqual(nextInfo(0, T), { level: 0, name: '', next: 'Đồng', need: 10 });
  assert.deepEqual(nextInfo(7, T), { level: 0, name: '', next: 'Đồng', need: 3 });
  assert.deepEqual(nextInfo(NaN, T), { level: 0, name: '', next: 'Đồng', need: 10 });
});

test('nextInfo in the middle', () => {
  assert.deepEqual(nextInfo(10, T), { level: 1, name: 'Đồng', next: 'Bạc', need: 90 });
  assert.deepEqual(nextInfo(499, T), { level: 2, name: 'Bạc', next: 'Vàng', need: 1 });
  assert.deepEqual(nextInfo(1999, T), { level: 3, name: 'Vàng', next: 'Kim cương', need: 1 });
});

test('nextInfo at level 4', () => {
  assert.deepEqual(nextInfo(2000, T), { level: 4, name: 'Kim cương', next: null, need: 0 });
  assert.deepEqual(nextInfo(50000, T), { level: 4, name: 'Kim cương', next: null, need: 0 });
});

test('nextInfo uses custom tiers', () => {
  assert.deepEqual(nextInfo(3, [5, 6, 7, 8]), { level: 0, name: '', next: 'Đồng', need: 2 });
});

test('tiers argument is not mutated', () => {
  const tiers = [10, 100, 500, 2000];
  levelOf(50, tiers);
  nextInfo(50, tiers);
  assert.deepEqual(tiers, [10, 100, 500, 2000]);
});
