// Nối mục tiêu tim / chia sẻ / bình chọn vào game.mjs. Chạy trong thư mục dữ liệu tạm (APP_HOME) để không ghi vào data/ thật.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tsbd-engage-'));
process.env.APP_HOME = home;
fs.mkdirSync(path.join(home, 'data'), { recursive: true });

const { setBroadcaster } = await import('../src/core/bus.mjs');
const { settings } = await import('../src/domain/settings.mjs');
const { S, fans } = await import('../src/domain/store.mjs');
const { _setPrepare } = await import('../src/audio/tts-queue.mjs');
const { textOf } = await import('../src/audio/tts-engine.mjs');
const { onLike, onShare, onChat, snapshot } = await import('../src/domain/game.mjs');
const { startPollLoop, pollView } = await import('../src/domain/poll.mjs');

const spoken = [], events = [];
setBroadcaster(m => events.push(m));
_setPrepare(async parts => { spoken.push(textOf(parts)); return { url: 'x', bytes: 600, sec: 0.01 }; });
const ofType = t => events.filter(e => e.t === t);
const reset = () => { spoken.length = 0; events.length = 0; };

test('tim: người chưa có quê vẫn được đếm; vượt nhiều mốc chỉ phát một sự kiện', () => {
  settings.heartGoalOn = true; settings.heartGoalStep = 100;
  S.hearts = undefined;   // phiên cũ chưa có hearts vẫn chạy
  reset();
  onLike('real1', 'Lan', 30, '');
  assert.equal(S.hearts, 30);
  assert.equal(ofType('heart').length, 0);
  onLike('real1', 'Lan', 100000, '');   // bị cắt còn 100
  assert.equal(S.hearts, 130);
  const h = ofType('heart');
  assert.equal(h.length, 1);
  assert.deepEqual(h[0], { t: 'heart', total: 130, step: 100, milestone: 100 });
  onLike('demo_x', 'Bot', 50, '');
  onLike('auto_x', 'Bot', 50, '');
  assert.equal(S.hearts, 130, 'người xem ảo không được đếm');
  settings.heartGoalStep = 50;   // đổi bước không phát lại mốc cũ
  reset();
  onLike('real1', 'Lan', 5, '');
  assert.equal(ofType('heart').length, 0);
  const sn = snapshot();
  assert.equal(sn.hearts.total, 135);
  settings.heartGoalOn = false;
  assert.equal(snapshot().hearts, null);
  settings.heartGoalOn = true;
});

test('tim: mỗi mốc có một sự kiện và lời MC không nhắc quà', async () => {
  settings.heartGoalStep = 50; S.hearts = 0; reset();
  for (let i = 0; i < 8; i++) onLike('real1', 'Lan', 50, '');
  await new Promise(r => setTimeout(r, 300));
  assert.equal(ofType('heart').length, 8);
  for (const t of spoken) assert.doesNotMatch(t, /quà|xu|tặng/i);
  assert.ok(spoken.length >= 1, 'MC phải nói ít nhất một câu');
});

test('chia sẻ: thưởng quê, giới hạn 5 phút mỗi người, bỏ qua bot, tắt được', () => {
  settings.shareRewardOn = true; settings.sharePts = 30;
  fans.sh1 = { name: 'Minh', home: 'Hà Nội', seen: Date.now() };
  S.pts = {}; reset();
  onShare('sh1', 'Minh', 'a.png');
  assert.equal(S.pts['Hà Nội'], 30);
  const s = ofType('share');
  assert.equal(s.length, 1);
  assert.deepEqual(s[0], { t: 'share', name: 'Minh', avatar: 'a.png', prov: 'Hà Nội' });
  onShare('sh1', 'Minh', 'a.png');   // trong 5 phút: bỏ
  assert.equal(ofType('share').length, 1);
  assert.equal(S.pts['Hà Nội'], 30);
  onShare('demo_1', 'Bot', ''); onShare('auto_1', 'Bot', '');
  assert.equal(ofType('share').length, 1);
  onShare('sh2', 'Người lạ', '');   // chưa có quê: vẫn có sự kiện, không cộng điểm
  assert.equal(ofType('share').length, 2);
  assert.equal(ofType('share')[1].prov, '');
  assert.equal(S.pts['Hà Nội'], 30);
  settings.shareRewardOn = false;
  onShare('sh3', 'Khác', '');
  assert.equal(ofType('share').length, 2);
  settings.shareRewardOn = true;
});

test('chia sẻ: lời MC tối đa 1 câu mỗi 8 giây, sự kiện overlay vẫn phát', async () => {
  reset();
  onShare('c1', 'An', ''); onShare('c2', 'Bình', ''); onShare('c3', 'Cường', '');
  await new Promise(r => setTimeout(r, 300));
  assert.equal(ofType('share').length, 3);
  assert.ok(spoken.length <= 1, `đọc ${spoken.length} câu`);
});

test('bình chọn: bắt đầu khi có người thật, đếm phiếu, kết thúc đúng một lần, snapshot có poll', async () => {
  settings.pollOn = true; settings.pollEveryMin = 0; settings.pollSec = 1;
  reset();
  startPollLoop();
  onChat('pv1', 'Lan', 'xin chào', '');   // người thật comment: mốc lastReal
  let v = null;
  for (let i = 0; i < 60 && !v; i++) { await new Promise(r => setTimeout(r, 100)); v = pollView(); }
  assert.ok(v, 'bình chọn phải bắt đầu');
  assert.equal(v.active, true);
  assert.ok(v.options.length >= 2 && v.leftMs > 0 && v.endsAt > v.now - 1);
  assert.equal(snapshot().poll.question, v.question);
  onChat('pv1', 'Lan', 'A', '');
  onChat('pv2', 'Minh', 'b!', '');
  onChat('pv1', 'Lan', 'b', '');        // đổi ý
  onChat('auto_9', 'Bot', 'a', '');     // bot không được tính
  assert.equal(pollView().total, 2);
  for (let i = 0; i < 40 && !ofType('pollEnd').length; i++) await new Promise(r => setTimeout(r, 100));
  const e = ofType('pollEnd');
  assert.equal(e.length, 1);
  assert.equal(e[0].total, 2);
  assert.equal(e[0].winner, 1);
  assert.equal(e[0].tie, false);
  assert.equal(pollView(), null);
  settings.pollOn = false;
});

test.after(() => { try { fs.rmSync(home, { recursive: true, force: true }); } catch {} });
