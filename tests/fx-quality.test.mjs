import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQuality, PARTICLE_CAPS, frameScale, isFeedActive, FEED_ACTIVE_MS } from '../public/js/overlay/fx-quality.js';

function feedN(q, n, dt) {
  for (let i = 0; i < n; i++) q.feed(dt);
}

test('PARTICLE_CAPS đúng giá trị', () => {
  assert.deepEqual(PARTICLE_CAPS, [900, 500, 250]);
});

test('starts at level 0 with cap 900', () => {
  const q = createQuality();
  assert.equal(q.level(), 0);
  assert.equal(q.cap(), 900);
});

test('degrades one level after a 2s window averaging above 24ms', () => {
  const q = createQuality();
  feedN(q, 70, 30);
  assert.equal(q.level(), 1);
  assert.equal(q.cap(), 500);
  feedN(q, 70, 30);
  assert.equal(q.level(), 2);
  assert.equal(q.cap(), 250);
  feedN(q, 70, 30);
  assert.equal(q.level(), 2);
  assert.equal(q.cap(), 250);
});

test('feed returns the current level', () => {
  const q = createQuality();
  let r = 0;
  for (let i = 0; i < 70; i++) r = q.feed(30);
  assert.equal(r, 1);
});

test('does not degrade at exactly 24ms average', () => {
  const q = createQuality();
  feedN(q, 120, 24);
  assert.equal(q.level(), 0);
});

test('recovers one level after a 10s window averaging below 18ms', () => {
  const q = createQuality();
  feedN(q, 140, 30);
  assert.equal(q.level(), 2);
  feedN(q, 600, 16.7);
  assert.equal(q.level(), 1);
  feedN(q, 600, 16.7);
  assert.equal(q.level(), 0);
});

// Đưa bộ điều khiển tới mức 2 với cửa sổ sạch: hai cửa sổ 2000ms đúng (80 khung 25ms), không dư.
function levelTwoClean() {
  const q = createQuality();
  feedN(q, 160, 25);
  assert.equal(q.level(), 2);
  return q;
}

test('does not recover at exactly 18ms average (strict <)', () => {
  const q = levelTwoClean();
  feedN(q, 556, 18); // 10008ms, trung bình đúng 18
  assert.equal(q.level(), 2);
});

test('recovers when average is just below 18ms', () => {
  const q = levelTwoClean();
  feedN(q, 560, 17.9); // 10024ms, trung bình 17.9 (556 khung mới chỉ 9952ms, chưa đủ cửa sổ 10s)
  assert.equal(q.level(), 1);
});

test('ignores stalls', () => {
  const q = createQuality();
  for (let i = 0; i < 100; i++) {
    q.feed(2000);
    q.feed(501);
    q.feed(0);
    q.feed(-5);
  }
  assert.equal(q.level(), 0);
});

test('reset returns to level 0', () => {
  const q = createQuality();
  feedN(q, 140, 30);
  assert.equal(q.level(), 2);
  q.reset();
  assert.equal(q.level(), 0);
  assert.equal(q.cap(), 900);
});

test('frameScale: tỉ lệ theo 60fps và kẹp [0.25, 3]', () => {
  assert.ok(Math.abs(frameScale(1000 / 60) - 1) < 1e-9);
  assert.ok(Math.abs(frameScale(1000 / 30) - 2) < 1e-9);
  assert.equal(frameScale(1), 0.25);
  assert.equal(frameScale(1000), 3);
});

test('frameScale: giá trị không hợp lệ trả 1', () => {
  for (const v of [0, -5, NaN, Infinity]) assert.equal(frameScale(v), 1);
});

test('isFeedActive: trong cửa sổ 100ms là đang hoạt động', () => {
  assert.equal(FEED_ACTIVE_MS, 100);
  assert.equal(isFeedActive(1000, 950), true);
});

test('isFeedActive: đúng 100ms thì không còn hoạt động', () => {
  assert.equal(isFeedActive(1000, 900), false);
});

test('isFeedActive: chưa từng cấp (0) hoặc mốc tương lai -> false', () => {
  assert.equal(isFeedActive(1000, 0), false);
  assert.equal(isFeedActive(1000, 2000), false);
});

test('isFeedActive: giá trị không hợp lệ -> false', () => {
  assert.equal(isFeedActive(NaN, 950), false);
  assert.equal(isFeedActive(1000, NaN), false);
  assert.equal(isFeedActive(undefined, 950), false);
  assert.equal(isFeedActive(1000, undefined), false);
});

test('isFeedActive: cửa sổ tùy chỉnh', () => {
  assert.equal(isFeedActive(1000, 500, 600), true);
});
