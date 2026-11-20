// #9 đổi style mỗi vòng + #10 hết vòng tắt đèn. Dữ liệu ở APP_HOME tạm.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tsbd-round-'));
process.env.APP_HOME = home;
fs.mkdirSync(path.join(home, 'data'), { recursive: true });

const { setBroadcaster } = await import('../src/core/bus.mjs');
const { settings, applySettings } = await import('../src/domain/settings.mjs');
const store = await import('../src/domain/store.mjs');
const { _setPrepare } = await import('../src/audio/tts-queue.mjs');
const { textOf } = await import('../src/audio/tts-engine.mjs');
const game = await import('../src/domain/game.mjs');

const events = [];
setBroadcaster(m => events.push(m));
_setPrepare(async parts => { textOf(parts); return { url: 'x', bytes: 600, sec: 0.01 }; });
const wait = ms => new Promise(r => setTimeout(r, ms));
const lit = at => ({ at, by: { name: 'A', avatar: '' }, people: ['u1'] });

test.after(() => { try { fs.rmSync(home, { recursive: true, force: true }); } catch {} });

test('cài đặt mới: mặc định và luật ép kiểu', () => {
  assert.equal(settings.themeRotate, false);
  assert.equal(settings.roundClearMap, false);
  assert.equal(settings.keepGifts, true);
  applySettings({ themeRotate: 1, roundClearMap: 'x', keepGifts: 0 });
  assert.deepEqual([settings.themeRotate, settings.roundClearMap, settings.keepGifts], [true, true, false]);
  applySettings({ themeRotate: false, roundClearMap: false, keepGifts: true });
});

test('bảng điều khiển có ô tick cho 3 cài đặt', () => {
  const html = fs.readFileSync(new URL('../public/control.html', import.meta.url), 'utf8');
  for (const k of ['themeRotate', 'roundClearMap', 'keepGifts']) {
    assert.match(html, new RegExp('type="checkbox" data-k="' + k + '"'));
  }
});

function arrange(){
  const S = store.S;
  Object.assign(S, { lit: { 'Huế': lit(Date.now() - 60000), 'Hà Nội': lit(Date.now() - 60000) }, who: { u1: { name: 'A', provs: ['Huế'] } }, pts: { 'Hà Nội': 10 }, gifts: { 'Huế': 50 }, hearts: 7, roundNo: 1, wins: {} });
  events.length = 0;
}
const resets = () => events.filter(e => e.t === 'reset').length;

test('resetSession(true) giữ số vòng, số vòng thắng và quà (keepGifts bật)', () => {
  settings.keepGifts = true;
  arrange();
  store.S.roundNo = 4;
  store.S.wins = { 'Hà Nội': 2 };
  store.resetSession(true);
  assert.equal(store.S.roundNo, 4);
  assert.equal(store.S.wins['Hà Nội'], 2);
  assert.deepEqual(store.S.gifts, { 'Huế': 50 });
  assert.deepEqual(store.S.lit, {});
});

test('resetSession(true) xóa quà khi keepGifts tắt, vẫn giữ số vòng', () => {
  settings.keepGifts = false;
  arrange();
  store.S.roundNo = 4;
  store.S.wins = { 'Hà Nội': 2 };
  store.resetSession(true);
  assert.deepEqual(store.S.gifts, {});
  assert.equal(store.S.roundNo, 4);
  settings.keepGifts = true;
});

test('resetSession(false) xóa hết', () => {
  settings.keepGifts = true;
  arrange();
  store.S.roundNo = 4;
  store.S.wins = { 'Hà Nội': 2 };
  store.resetSession(false);
  assert.equal(store.S.roundNo, 1);
  assert.deepEqual(store.S.wins, {});
  assert.deepEqual(store.S.gifts, {});
});

test('roundClearMap bật: tắt đèn sau thời gian chờ, giữ tỉnh mới sáng, tim và số vòng thắng', async () => {
  game.ROUND.clearMs = 40;
  settings.roundClearMap = true; settings.keepGifts = true;
  arrange();
  game.endRound();
  store.S.lit['Đà Nẵng'] = lit(Date.now() + 5000);
  assert.equal(Object.keys(store.S.lit).length, 3);
  await wait(150);
  assert.deepEqual(Object.keys(store.S.lit), ['Đà Nẵng']);
  assert.deepEqual(store.S.who, {});
  assert.equal(store.S.hearts, 7);
  assert.equal(store.S.wins['Hà Nội'], 1);
  assert.equal(store.S.roundNo, 2);
  assert.deepEqual(store.S.gifts, { 'Huế': 50 });
  assert.equal(resets(), 1);
  settings.roundClearMap = false;
});

test('keepGifts tắt: xóa quà khi tắt đèn', async () => {
  game.ROUND.clearMs = 40;
  settings.roundClearMap = true; settings.keepGifts = false;
  arrange();
  game.endRound();
  await wait(150);
  assert.deepEqual(store.S.gifts, {});
  settings.roundClearMap = false; settings.keepGifts = true;
});

test('roundClearMap tắt: không tắt đèn', async () => {
  game.ROUND.clearMs = 40;
  settings.roundClearMap = false;
  arrange();
  game.endRound();
  await wait(150);
  assert.equal(Object.keys(store.S.lit).length, 2);
  assert.equal(resets(), 0);
});

test('vòng không ai có điểm: không tắt đèn dù đã bật', async () => {
  game.ROUND.clearMs = 40;
  settings.roundClearMap = true;
  arrange();
  store.S.pts = {};
  game.endRound();
  await wait(150);
  assert.equal(Object.keys(store.S.lit).length, 2);
  assert.equal(resets(), 0);
  settings.roundClearMap = false;
});

test('hai lần hết vòng liên tiếp: chỉ tắt đèn một lần', async () => {
  game.ROUND.clearMs = 40;
  settings.roundClearMap = true;
  arrange();
  game.endRound();
  store.S.pts = { 'Huế': 3 };
  game.endRound();
  await wait(150);
  assert.equal(resets(), 1);
  settings.roundClearMap = false;
});

test('chưa có gói giao diện (pool mặc định): bật themeRotate cũng không đổi, không lỗi', () => {
  settings.theme = 'mac-dinh';
  settings.themeRotate = true;
  assert.equal(game.rotateTheme(), false);
  assert.equal(settings.theme, 'mac-dinh');
  settings.themeRotate = false;
});

test('rotateTheme: tắt thì không đổi; bật thì luôn ra style khác trong pool', () => {
  const pool = ['mac-dinh', 'neon', 'tet'];
  game.setThemePool(() => pool);
  settings.theme = 'neon';
  settings.themeRotate = false;
  assert.equal(game.rotateTheme(), false);
  assert.equal(settings.theme, 'neon');
  settings.themeRotate = true;
  for (let i = 0; i < 30; i++) {
    const before = settings.theme;
    assert.equal(game.rotateTheme(), true);
    assert.notEqual(settings.theme, before);
    assert.ok(pool.includes(settings.theme));
  }
  settings.themeRotate = false;
});

test('pool chỉ còn style đang dùng: không đổi', () => {
  game.setThemePool(() => ['neon']);
  settings.theme = 'neon';
  settings.themeRotate = true;
  assert.equal(game.rotateTheme(), false);
  assert.equal(settings.theme, 'neon');
  settings.themeRotate = false;
});

test('rotateTheme báo cho bảng điều khiển', () => {
  game.setThemePool(() => ['mac-dinh', 'neon', 'tet']);
  settings.theme = 'neon';
  settings.themeRotate = true;
  events.length = 0;
  assert.equal(game.rotateTheme(), true);
  const ev = events.filter(e => e.t === 'settings');
  assert.equal(ev.length, 1);
  assert.equal(ev[0].settings.theme, settings.theme);
  settings.themeRotate = false;
});

test('endRound: có người thắng thì đổi style, không ai có điểm thì giữ', () => {
  game.setThemePool(() => ['mac-dinh', 'neon', 'tet']);
  settings.roundClearMap = false; settings.themeRotate = true;
  settings.theme = 'neon';
  arrange();
  game.endRound();
  assert.notEqual(settings.theme, 'neon');
  settings.theme = 'neon';
  store.S.pts = {};
  game.endRound();
  assert.equal(settings.theme, 'neon');
  settings.themeRotate = false;
});

test('newSession hủy hẹn giờ tắt đèn của vòng trước', async () => {
  game.ROUND.clearMs = 40;
  settings.roundClearMap = true;
  arrange();
  game.endRound();
  game.newSession();
  store.S.who = { u9: { name: 'B', provs: [] } };
  events.length = 0;
  await wait(150);
  assert.ok(store.S.who.u9);
  assert.equal(resets(), 0);
  settings.roundClearMap = false;
});

test('resetMap hủy hẹn giờ tắt đèn của vòng trước', async () => {
  game.ROUND.clearMs = 40;
  settings.roundClearMap = true;
  arrange();
  game.endRound();
  game.resetMap();
  store.S.who = { u9: { name: 'B', provs: [] } };
  events.length = 0;
  await wait(150);
  assert.ok(store.S.who.u9);
  assert.equal(resets(), 0);
  settings.roundClearMap = false;
});
