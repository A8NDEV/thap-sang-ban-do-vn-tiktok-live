import { test } from 'node:test';
import assert from 'node:assert/strict';
import { milestonesCrossed, topMilestone, heartView } from '../src/domain/heartgoal.mjs';

// ---- milestonesCrossed ----

test('milestonesCrossed: boundary 999 -> 1000 crosses one, 1000 -> 1000 none', () => {
  assert.equal(milestonesCrossed(999, 1000, 1000), 1);
  assert.equal(milestonesCrossed(1000, 1000, 1000), 0);
  assert.equal(milestonesCrossed(1000, 1001, 1000), 0);
  assert.equal(milestonesCrossed(0, 999, 1000), 0);
  assert.equal(milestonesCrossed(0, 1000, 1000), 1);
});

test('milestonesCrossed: 2900 -> 3100 crosses exactly the 3000 mark', () => {
  assert.equal(milestonesCrossed(2900, 3100, 1000), 1);
});

test('milestonesCrossed: a big jump crosses many marks', () => {
  assert.equal(milestonesCrossed(0, 5000, 1000), 5);
  assert.equal(milestonesCrossed(950, 4050, 1000), 4);
  assert.equal(milestonesCrossed(10, 40, 10), 3);
});

test('milestonesCrossed: invalid input returns 0', () => {
  assert.equal(milestonesCrossed(0, 5000, 0), 0);
  assert.equal(milestonesCrossed(0, 5000, -1000), 0);
  assert.equal(milestonesCrossed(0, 5000, NaN), 0);
  assert.equal(milestonesCrossed(0, 5000, undefined), 0);
  assert.equal(milestonesCrossed(0, 5000, '1000'), 0);
  assert.equal(milestonesCrossed(NaN, 5000, 1000), 0);
  assert.equal(milestonesCrossed(0, NaN, 1000), 0);
  assert.equal(milestonesCrossed(0, Infinity, 1000), 0);
  assert.equal(milestonesCrossed(-5, 5000, 1000), 0);
  assert.equal(milestonesCrossed(null, 5000, 1000), 0);
});

test('milestonesCrossed: total going down or staying put returns 0', () => {
  assert.equal(milestonesCrossed(3100, 2900, 1000), 0);
  assert.equal(milestonesCrossed(500, 500, 1000), 0);
});

// ---- topMilestone ----

test('topMilestone: highest mark reached', () => {
  assert.equal(topMilestone(2900, 3100, 1000), 3000);
  assert.equal(topMilestone(999, 1000, 1000), 1000);
  assert.equal(topMilestone(0, 5000, 1000), 5000);
  assert.equal(topMilestone(950, 4050, 1000), 4000);
});

test('topMilestone: a large single event emits one value, not many', () => {
  assert.equal(topMilestone(5, 35, 10), 30);
  assert.equal(typeof topMilestone(5, 35, 10), 'number');
});

test('topMilestone: no crossing or invalid input returns null', () => {
  assert.equal(topMilestone(1000, 1000, 1000), null);
  assert.equal(topMilestone(0, 999, 1000), null);
  assert.equal(topMilestone(3000, 2000, 1000), null);
  assert.equal(topMilestone(0, 5000, 0), null);
  assert.equal(topMilestone(0, 5000, -1), null);
  assert.equal(topMilestone(0, 5000, NaN), null);
  assert.equal(topMilestone(NaN, 5000, 1000), null);
});

test('topMilestone: changing the step mid-session does not replay old marks', () => {
  // total is already 3000 under step 1000; switching to 500 only reacts to NEW growth
  assert.equal(topMilestone(3000, 3000, 500), null);
  assert.equal(topMilestone(3000, 3010, 500), null);
  assert.equal(topMilestone(3000, 3500, 500), 3500);
});

// ---- heartView ----

test('heartView at zero', () => {
  assert.deepEqual(heartView(0, 1000), { total: 0, step: 1000, next: 1000, prev: 0, pct: 0 });
});

test('heartView exactly on a mark starts the next leg', () => {
  assert.deepEqual(heartView(1000, 1000), { total: 1000, step: 1000, next: 2000, prev: 1000, pct: 0 });
  assert.deepEqual(heartView(3000, 1000), { total: 3000, step: 1000, next: 4000, prev: 3000, pct: 0 });
});

test('heartView between two marks', () => {
  assert.deepEqual(heartView(1250, 1000), { total: 1250, step: 1000, next: 2000, prev: 1000, pct: 25 });
  assert.deepEqual(heartView(500, 1000), { total: 500, step: 1000, next: 1000, prev: 0, pct: 50 });
  assert.deepEqual(heartView(2750, 500), { total: 2750, step: 500, next: 3000, prev: 2500, pct: 50 });
});

test('heartView: bad step falls back to 1000', () => {
  for (const bad of [0, -5, NaN, undefined, null, 'x', Infinity]) {
    const v = heartView(1500, bad);
    assert.equal(v.step, 1000, `step ${String(bad)}`);
    assert.equal(v.next, 2000);
    assert.equal(v.prev, 1000);
    assert.equal(v.pct, 50);
  }
});

test('heartView: bad total is treated as zero; pct stays within 0-100', () => {
  assert.equal(heartView(NaN, 1000).total, 0);
  assert.equal(heartView(-40, 1000).total, 0);
  for (const t of [0, 1, 499, 999, 1000, 123456]) {
    const v = heartView(t, 1000);
    assert.ok(v.pct >= 0 && v.pct <= 100, `pct ${v.pct} for ${t}`);
    assert.ok(v.next > v.total);
    assert.ok(v.prev <= v.total);
  }
});
