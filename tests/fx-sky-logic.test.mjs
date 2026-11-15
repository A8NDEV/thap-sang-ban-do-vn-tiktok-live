import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skyPhase, SKY_COLORS, nextChangeMs } from '../public/js/overlay/fx-sky-logic.js';

test('skyPhase: các ranh giới giờ', () => {
  const cases = [[4.99, 'night'], [5, 'dawn'], [6.99, 'dawn'], [7, 'day'], [16.99, 'day'], [17, 'dusk'], [18.99, 'dusk'], [19, 'night'], [23.99, 'night'], [0, 'night']];
  for (const [h, want] of cases) assert.equal(skyPhase(h), want, 'h=' + h);
});

test('skyPhase: giá trị không hợp lệ thì là đêm', () => {
  for (const v of [NaN, Infinity, -Infinity, undefined, null, '12']) assert.equal(skyPhase(v), 'night');
});

test('SKY_COLORS: đủ bốn khung, mỗi khung hai màu rgba, alpha <= .55', () => {
  for (const p of ['dawn', 'day', 'dusk', 'night']) {
    const c = SKY_COLORS[p];
    assert.equal(c.length, 2);
    for (const col of c) {
      const m = /^rgba\(\d+,\d+,\d+,(\.?\d+(?:\.\d+)?)\)$/.exec(col);
      assert.ok(m, col);
      assert.ok(Number(m[1]) <= 0.55, col);
    }
  }
});

test('nextChangeMs: dương và không quá 12 giờ, kể cả các giờ sát ranh giới', () => {
  for (let h = 0; h < 24; h++) for (const m of [0, 30, 59]) {
    const ms = nextChangeMs(new Date(2026, 5, 15, h, m, 0));
    assert.ok(ms >= 1000 && ms <= 12 * 3600000, `${h}:${m} -> ${ms}`);
  }
  assert.equal(nextChangeMs(new Date(2026, 5, 15, 6, 0, 0)), 3600000);
  assert.equal(nextChangeMs(new Date(2026, 5, 15, 23, 0, 0)), 6 * 3600000);
});
