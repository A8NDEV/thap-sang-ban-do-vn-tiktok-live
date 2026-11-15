import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fxFlags } from '../src/domain/fx-flags.mjs';
import { settings } from '../src/domain/settings.mjs';

const KEYS = ['ambient', 'wave', 'name', 'combo', 'sky', 'intro', 'beat', 'region'];

test('fxFlags: đúng 8 khóa bool, không thừa', () => {
  const f = fxFlags(settings);
  assert.deepEqual(Object.keys(f).sort(), [...KEYS].sort());
  for (const k of KEYS) assert.equal(typeof f[k], 'boolean');
});

test('fxFlags: mặc định bật 6, tắt beat và region', () => {
  const f = fxFlags({ fxAmbient: true, fxWave: true, fxName: true, fxCombo: true, fxSky: true, fxIntro: true, fxBeat: false, fxRegion: false });
  assert.deepEqual(f, { ambient: true, wave: true, name: true, combo: true, sky: true, intro: true, beat: false, region: false });
});

test('fxFlags: ép bool cho giá trị truthy/falsy', () => {
  const f = fxFlags({ fxAmbient: 1, fxWave: 0, fxName: 'x', fxCombo: undefined, fxSky: null, fxIntro: '', fxBeat: [], fxRegion: NaN });
  assert.deepEqual(f, { ambient: true, wave: false, name: true, combo: false, sky: false, intro: false, beat: true, region: false });
});

test('fxFlags: thiếu settings hoặc thiếu khóa -> toàn false', () => {
  const off = Object.fromEntries(KEYS.map(k => [k, false]));
  assert.deepEqual(fxFlags(undefined), off);
  assert.deepEqual(fxFlags(null), off);
  assert.deepEqual(fxFlags({}), off);
});

test('fxFlags: bỏ qua khóa lạ', () => {
  assert.deepEqual(Object.keys(fxFlags({ foo: 1, fxAmbient: true })).sort(), [...KEYS].sort());
});
