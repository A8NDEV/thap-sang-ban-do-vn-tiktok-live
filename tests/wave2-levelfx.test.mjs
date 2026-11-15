// Đợt sửa 1: lời MC cấp/hạng gộp một câu, thời gian chờ, người tặng đầu tiên không có cảnh vượt, lỗi hiệu ứng không chặn quà, chuẩn hóa mốc cấp.
// Chạy trong thư mục dữ liệu tạm (APP_HOME) để không ghi vào data/ thật.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tsbd-wave2-'));
process.env.APP_HOME = home;
fs.mkdirSync(path.join(home, 'data'), { recursive: true });

const { setBroadcaster } = await import('../src/core/bus.mjs');
const { settings, applySettings } = await import('../src/domain/settings.mjs');
const { S, fans } = await import('../src/domain/store.mjs');
const { _setPrepare } = await import('../src/audio/tts-queue.mjs');
const { textOf } = await import('../src/audio/tts-engine.mjs');
const { onGift, _resetLevelSay } = await import('../src/domain/game.mjs');
const { perUserCap } = await import('../src/domain/mission.mjs');

const spoken = [], events = [];
setBroadcaster(m => events.push(m));
_setPrepare(async parts => { spoken.push(textOf(parts)); return { url: 'x', bytes: 600, sec: 0.01 }; });
const ofType = t => events.filter(e => e.t === t);
// lọc theo tên người tặng: hàng đợi giọng đọc là bất đồng bộ nên câu của lượt trước có thể đến muộn
const lvLines = who => spoken.filter(t => t.includes(who) && /lên cấp|đã đạt cấp|vượt .* lên hạng|vào top/.test(t));
const wait = ms => new Promise(r => setTimeout(r, ms));
const giftAs = (uid, name, coins) => { fans[uid] = { name, home: 'Hà Nội', seen: Date.now() }; onGift(uid, name, 'Tim', 1, coins, ''); };
const reset = () => { spoken.length = 0; events.length = 0; };
const realNow = Date.now;
let off = 0;
Date.now = () => realNow() + off;

test('người tặng đầu tiên của buổi: có lên cấp nhưng không có cảnh vượt hạng', async () => {
  Object.assign(settings, { levelOn: true, overtakeOn: true, mcGiftCta: false });
  S.donors = {}; _resetLevelSay(); reset();
  giftAs('a', 'An', 15);
  await wait(1000);
  assert.equal(ofType('overtake').length, 0);
  assert.equal(ofType('levelUp').length, 1);
  assert.equal(lvLines('An').length, 1);
  assert.match(lvLines('An')[0], /An lên cấp Đồng!/);
});

test('lên cấp + vượt hạng cùng một quà: MỘT câu MC, hai sự kiện hình', async () => {
  _resetLevelSay(); reset();
  giftAs('b', 'Bình', 20);   // 20 > 15 của An: hạng 1, vượt An, cũng lên cấp Đồng
  await wait(1000);
  assert.equal(ofType('levelUp').length, 1);
  const ov = ofType('overtake');
  assert.equal(ov.length, 1);
  assert.equal(ov[0].rank, 1); assert.equal(ov[0].passedName, 'An');
  assert.equal(lvLines('Bình').length, 1, 'chỉ một câu cấp/hạng: ' + JSON.stringify(lvLines('Bình')));
  assert.match(lvLines('Bình')[0], /Bình lên cấp Đồng và vượt An lên hạng 1!/);
  assert.doesNotMatch(lvLines('Bình')[0], /Còn/);
});

test('thời gian chờ toàn cục 8 giây: sự kiện hình vẫn phát, MC không nói thêm', async () => {
  reset();   // không reset thời gian chờ: người trước vừa được đọc
  giftAs('c', 'Chi', 30);
  await wait(1000);
  assert.equal(ofType('levelUp').length, 1);
  assert.equal(ofType('overtake').length, 1);
  assert.equal(lvLines('Chi').length, 0, 'phải im lặng: ' + JSON.stringify(lvLines('Chi')));
});

test('thời gian chờ mỗi người 20 giây (qua mốc 8 giây toàn cục)', async () => {
  _resetLevelSay(); reset();
  giftAs('d', 'Dũng', 25);   // hạng 2, vượt Bình
  await wait(1000);
  assert.equal(lvLines('Dũng').length, 1);
  off += 9000; reset();   // quá 8 giây toàn cục nhưng chưa tới 20 giây của riêng Dũng
  giftAs('d', 'Dũng', 100);   // Dũng 125: lên Bạc, vượt Chi lên hạng 1
  await wait(1000);
  assert.equal(ofType('levelUp').length, 1);
  assert.equal(ofType('overtake').length, 1);
  assert.equal(lvLines('Dũng').length, 0);
  off += 12000; reset();   // đã qua 20 giây
  giftAs('d', 'Dũng', 500);   // Dũng 625: lên Vàng
  await wait(1000);
  assert.equal(lvLines('Dũng').length, 1);
  off = 0;
});

test('hạng 4-5 mà không vượt ai: hiện cảnh nhưng MC không đọc "vào top"', async () => {
  Object.assign(settings, { levelOn: false, overtakeOn: true });
  S.donors = { x1: { name: 'X1', coins: 500 }, x2: { name: 'X2', coins: 400 }, x3: { name: 'X3', coins: 300 } };
  _resetLevelSay(); reset();
  giftAs('n', 'Nam', 1);
  await wait(1000);
  const ov = ofType('overtake');
  assert.equal(ov.length, 1);
  assert.equal(ov[0].rank, 4); assert.equal(ov[0].passedName, '');
  assert.equal(lvLines('Nam').length, 0);
  settings.levelOn = true;
});

test('levelFx ném lỗi: quà vẫn được xử lý đủ', async () => {
  let n = 0;
  S.donors = new Proxy({ x: { name: 'X', coins: 50 } }, { ownKeys(t) { if (++n === 2) throw new Error('boom'); return Reflect.ownKeys(t); } });
  _resetLevelSay(); reset();
  assert.doesNotThrow(() => giftAs('t', 'Tú', 20));
  const g = ofType('gift');
  assert.equal(g.length, 1);
  assert.equal(g[0].coins, 20);
  assert.ok(n >= 2, 'lần gọi thứ 2 phải là chỗ ném lỗi');
  await wait(900);
  S.donors = {};
});

test('levelTiers được chuẩn hóa qua parseTiers (chuỗi chuẩn)', () => {
  applySettings({ levelTiers: '010,100,500,2000' }); assert.equal(settings.levelTiers, '10,100,500,2000');
  applySettings({ levelTiers: '1,2,3,4' }); assert.equal(settings.levelTiers, '1,2,3,4');
  applySettings({ levelTiers: '5,3,2,1' }); assert.equal(settings.levelTiers, '10,100,500,2000');
  applySettings({ levelTiers: '1,2,3' }); assert.equal(settings.levelTiers, '10,100,500,2000');
  applySettings({ levelTiers: 'abc' }); assert.equal(settings.levelTiers, '10,100,500,2000');
  applySettings({ levelTiers: '' }); assert.equal(settings.levelTiers, '10,100,500,2000');
});

test('trần comment mỗi người của nhiệm vụ: max(1, min(5, ceil(target/2)))', () => {
  assert.equal(perUserCap(30), 5);
  assert.equal(perUserCap(10), 5);
  assert.equal(perUserCap(9), 5);
  assert.equal(perUserCap(6), 3);
  assert.equal(perUserCap(5), 3);
  assert.equal(perUserCap(2), 1);
  assert.equal(perUserCap(1), 1);
  assert.equal(perUserCap(1000), 5);
  assert.ok(perUserCap(5) < 5, 'một người không tự hoàn thành');
});

test.after(() => { Date.now = realNow; try { fs.rmSync(home, { recursive: true, force: true }); } catch {} });
