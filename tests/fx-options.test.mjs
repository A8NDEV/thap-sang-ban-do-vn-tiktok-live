import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setFxOptions, fxOn } from '../public/js/overlay/fx-options.js';

const KEYS = ['ambient', 'wave', 'name', 'combo', 'sky', 'intro', 'beat', 'region'];

test('fx-options: trước khi nhận look.fx tất cả đều tắt', () => {
  for (const k of KEYS) assert.equal(fxOn(k), false);
});

test('fx-options: nhận đủ 8 cờ', () => {
  setFxOptions({ ambient: true, wave: false, name: true, combo: false, sky: true, intro: false, beat: true, region: false });
  assert.deepEqual(KEYS.map(fxOn), [true, false, true, false, true, false, true, false]);
});

test('fx-options: thiếu hoặc sai kiểu thì thành false, luôn trả bool', () => {
  setFxOptions({ ambient: true, wave: 'true', name: 1, combo: null, sky: undefined });
  assert.equal(fxOn('ambient'), true);
  for (const k of KEYS.slice(1)) assert.equal(fxOn(k), false);
  for (const k of KEYS) assert.equal(typeof fxOn(k), 'boolean');
});

test('fx-options: tên lạ trả false (kể cả tên có sẵn trên Object)', () => {
  setFxOptions({ ambient: true, bogus: true });
  assert.equal(fxOn('bogus'), false);
  assert.equal(fxOn('toString'), false);
  assert.equal(fxOn('__proto__'), false);
  assert.equal(fxOn(undefined), false);
});

test('fx-options: sửa object đã truyền vào sau đó không đổi cờ đã lưu', () => {
  const fx = { ambient: true, wave: true };
  setFxOptions(fx);
  fx.ambient = false; fx.wave = false; fx.name = true;
  assert.equal(fxOn('ambient'), true);
  assert.equal(fxOn('wave'), true);
  assert.equal(fxOn('name'), false);
});

test('fx-options: setFxOptions(null/undefined/không phải object) đặt lại tất cả về false', () => {
  for (const bad of [null, undefined, 'x', 5]) {
    setFxOptions({ ambient: true, combo: true });
    assert.equal(fxOn('combo'), true);
    setFxOptions(bad);
    for (const k of KEYS) assert.equal(fxOn(k), false);
  }
});
