import { test } from 'node:test';
import assert from 'node:assert/strict';
import { smoothStep, softScale, isSettled, SOFT_HALF_LIFE_MS } from '../public/js/overlay/fx-camera-logic.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('SOFT_HALF_LIFE_MS is 260', () => {
  assert.equal(SOFT_HALF_LIFE_MS, 260);
});

test('after one half-life the gap halves', () => {
  near(smoothStep(0, 100, 260, 260), 50);
});

test('after two half-lives the gap is a quarter', () => {
  near(smoothStep(0, 100, 520, 260), 75);
});

test('frame-rate independent: one 100ms step equals ten 10ms steps', () => {
  const one = smoothStep(0, 100, 100, 260);
  let cur = 0;
  for (let i = 0; i < 10; i++) cur = smoothStep(cur, 100, 10, 260);
  near(one, cur);
});

test('dt that is not a finite positive number returns cur unchanged', () => {
  for (const dt of [0, -16, NaN, Infinity, -Infinity, undefined, '16']) {
    assert.equal(smoothStep(7, 100, dt, 260), 7);
  }
});

test('halfLife that is not a finite positive number returns target', () => {
  for (const h of [0, -1, NaN, Infinity, undefined]) {
    assert.equal(smoothStep(7, 100, 16, h), 100);
  }
});

test('non-finite cur/target fall back sensibly', () => {
  assert.equal(smoothStep(NaN, 100, 16, 260), 100);
  assert.equal(smoothStep(5, NaN, 16, 260), 5);
  assert.equal(smoothStep(NaN, NaN, 16, 260), NaN);
});

test('converges monotonically without overshoot', () => {
  let cur = 0;
  let prev = -1;
  for (let i = 0; i < 300; i++) {
    cur = smoothStep(cur, 100, 16.7, SOFT_HALF_LIFE_MS);
    assert.ok(cur > prev && cur <= 100);
    prev = cur;
  }
  assert.ok(100 - cur < 0.01);
  // downward too
  let d = 100;
  let pd = 101;
  for (let i = 0; i < 50; i++) {
    d = smoothStep(d, 0, 16.7, SOFT_HALF_LIFE_MS);
    assert.ok(d < pd && d >= 0);
    pd = d;
  }
});

test('softScale by province size', () => {
  assert.equal(softScale('sm'), 1.3);
  assert.equal(softScale('md'), 1.22);
  assert.equal(softScale('lg'), 1.15);
  assert.equal(softScale(undefined), 1.15);
  assert.equal(softScale('xyz'), 1.15);
});

test('isSettled thresholds are strict', () => {
  assert.equal(isSettled(0, 0, 0), true);
  assert.equal(isSettled(0.049, -0.049, 0.00049), true);
  assert.equal(isSettled(0.05, 0, 0), false);
  assert.equal(isSettled(0, -0.05, 0), false);
  assert.equal(isSettled(0, 0, 0.0005), false);
  assert.equal(isSettled(0, 0, -0.0005), false);
});
