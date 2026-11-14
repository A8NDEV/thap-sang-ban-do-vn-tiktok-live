import test from 'node:test';
import assert from 'node:assert/strict';
import { crossedFull } from '../src/domain/full-rule.mjs';

test('một quà đủ ngưỡng thì bật', () => {
  assert.equal(crossedFull(500, 500, 500), true);
  assert.equal(crossedFull(10000, 10000, 10000), true);
  assert.equal(crossedFull(600, 600, 500), true);
});

test('cộng dồn vượt mốc đầu tiên thì bật', () => {
  assert.equal(crossedFull(520, 120, 500), true);   // trước đó 400
});

test('đã quá mốc rồi, quà tiếp theo chưa vượt mốc mới thì KHÔNG bật lại', () => {
  assert.equal(crossedFull(700, 200, 500), false);  // trước đó 500
  assert.equal(crossedFull(999, 1, 500), false);
});

test('vượt thêm một mốc nữa thì bật lại', () => {
  assert.equal(crossedFull(1000, 300, 500), true);  // trước đó 700
  assert.equal(crossedFull(1500, 1000, 500), true);
});

test('chưa đủ ngưỡng thì không bật', () => {
  assert.equal(crossedFull(499, 499, 500), false);
  assert.equal(crossedFull(300, 100, 500), false);
});

test('người không có tổng cộng dồn (undefined) thì xét riêng quà đó', () => {
  assert.equal(crossedFull(undefined, 600, 500), true);
  assert.equal(crossedFull(undefined, 100, 500), false);
});

test('ngưỡng 0, âm, NaN hoặc không phải số thì tắt tính năng', () => {
  assert.equal(crossedFull(900, 900, 0), false);
  assert.equal(crossedFull(900, 900, -5), false);
  assert.equal(crossedFull(900, 900, NaN), false);
  assert.equal(crossedFull(900, 900, undefined), false);
});

test('quà 0 xu hoặc không hợp lệ không bật', () => {
  assert.equal(crossedFull(900, 0, 500), false);
  assert.equal(crossedFull(900, NaN, 500), false);
});
