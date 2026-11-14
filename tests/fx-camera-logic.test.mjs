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

// ---- lò xo giảm chấn tới hạn (springStep): bắt đầu êm, không vượt đích, giữ vận tốc khi đổi đích ----
import { springStep, SOFT_OMEGA, PAN_FRACTION } from '../public/js/overlay/fx-camera-logic.js';

test('springStep: bắt đầu êm — bước đầu nhỏ hơn nhiều so với làm mượt hàm mũ', () => {
  const s = springStep(0, 0, 400, 16.7, SOFT_OMEGA);
  const e = smoothStep(0, 400, 16.7, SOFT_HALF_LIFE_MS);
  assert.ok(s.x < 4, `bước đầu của lò xo phải nhỏ (<4px), được ${s.x}`);
  assert.ok(e > 15, `hàm mũ cũ nhảy hơn 15px ở khung đầu, được ${e}`);
  assert.ok(s.v > 0);
});

test('springStep: tốc độ tăng dần rồi giảm (đường cong chữ S), không đổi chiều', () => {
  let st = { x: 0, v: 0 };
  const speeds = [];
  for (let i = 0; i < 120; i++) { const nx = springStep(st.x, st.v, 300, 16.7, SOFT_OMEGA); speeds.push(nx.x - st.x); st = nx; }
  const peak = speeds.indexOf(Math.max(...speeds));
  assert.ok(peak > 3 && peak < 40, `đỉnh tốc độ ở khung ${peak}`);
  assert.ok(speeds.every(d => d >= -1e-9), 'không bao giờ đi lùi');
  assert.ok(Math.max(...speeds) < 8, `tốc độ tối đa mỗi khung < 8px, được ${Math.max(...speeds)}`);
});

test('springStep: không vượt đích và hội tụ', () => {
  let st = { x: 0, v: 0 };
  for (let i = 0; i < 300; i++) { st = springStep(st.x, st.v, 100, 16.7, SOFT_OMEGA); assert.ok(st.x <= 100 + 1e-9, `vượt đích: ${st.x}`); }
  near(st.x, 100, 1e-3);
  assert.ok(Math.abs(st.v) < 1e-3);
});

test('springStep: độc lập tốc độ khung hình (1 bước 100ms = 10 bước 10ms)', () => {
  const a = springStep(0, 0, 100, 100, SOFT_OMEGA);
  let b = { x: 0, v: 0 };
  for (let i = 0; i < 10; i++) b = springStep(b.x, b.v, 100, 10, SOFT_OMEGA);
  near(a.x, b.x, 1e-9);
  near(a.v, b.v, 1e-9);
});

test('springStep: đổi đích giữa chừng vẫn giữ vận tốc (không giật)', () => {
  let st = { x: 0, v: 0 };
  for (let i = 0; i < 20; i++) st = springStep(st.x, st.v, 100, 16.7, SOFT_OMEGA);
  const after = springStep(st.x, st.v, 0, 0.001, SOFT_OMEGA);   // đổi đích rồi gần như không trôi thời gian
  near(after.v, st.v, 1e-2);
  near(after.x, st.x, 1e-2);
});

test('springStep: đầu vào không hợp lệ', () => {
  assert.deepEqual(springStep(5, 2, 100, 0, SOFT_OMEGA), { x: 5, v: 2 });
  assert.deepEqual(springStep(5, 2, 100, -3, SOFT_OMEGA), { x: 5, v: 2 });
  assert.deepEqual(springStep(5, 2, 100, NaN, SOFT_OMEGA), { x: 5, v: 2 });
  assert.deepEqual(springStep(5, 2, 100, 16, 0), { x: 100, v: 0 });
  assert.deepEqual(springStep(NaN, 1, 100, 16, SOFT_OMEGA), { x: 100, v: 0 });
  assert.deepEqual(springStep(5, NaN, 100, 16, SOFT_OMEGA).v >= 0, true);
});

test('PAN_FRACTION: chỉ dịch một phần quãng đường tới tỉnh', () => {
  assert.ok(PAN_FRACTION > 0.3 && PAN_FRACTION < 0.8);
});
