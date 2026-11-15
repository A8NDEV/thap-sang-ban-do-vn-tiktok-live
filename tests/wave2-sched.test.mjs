// Đợt sửa 1 + tim/chia sẻ/bình chọn: câu đố / Đại chiến không chạy chồng bình chọn hoặc nhiệm vụ; nhiệm vụ chỉ khi có người thật; hủy nhiệm vụ gửi cancel.
// Nhảy giờ bằng cách cộng độ lệch vào Date.now (các vòng lặp chạy 0,5–1 giây một lần). Dữ liệu ở APP_HOME tạm.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tsbd-sched-'));
process.env.APP_HOME = home;
fs.mkdirSync(path.join(home, 'data'), { recursive: true });

const { setBroadcaster } = await import('../src/core/bus.mjs');
const { settings } = await import('../src/domain/settings.mjs');
const { S } = await import('../src/domain/store.mjs');
const { _setPrepare } = await import('../src/audio/tts-queue.mjs');
const { textOf } = await import('../src/audio/tts-engine.mjs');
// import theo thứ tự lạ: kiểm tra vòng import game <-> quiz <-> duel <-> poll <-> mission <-> chest an toàn
const quiz = await import('../src/domain/quiz.mjs');
const duel = await import('../src/domain/duel.mjs');
const chest = await import('../src/domain/chest.mjs');
const game = await import('../src/domain/game.mjs');
const { startMissionLoop, missionView, missionOnChat } = await import('../src/domain/mission.mjs');
const { startPollLoop, pollView, pollOnChat } = await import('../src/domain/poll.mjs');

const events = [];
setBroadcaster(m => events.push(m));
_setPrepare(async parts => { textOf(parts); return { url: 'x', bytes: 600, sec: 0.01 }; });
const wait = ms => new Promise(r => setTimeout(r, ms));
const realNow = Date.now;
let off = 0;
Date.now = () => realNow() + off;

test('vòng import: các module nạp cùng nhau, hàm xuất đủ', () => {
  for (const f of [quiz.quizDue, quiz.startQuizLoop, duel.startDuelLoop, duel.duelView, chest.isChestActive, game.snapshot, game.onGift]) assert.equal(typeof f, 'function');
  assert.equal(game.snapshot().poll, null);
  assert.equal(game.snapshot().mission, null);
});

test('câu đố không tới lượt khi đang bình chọn; Đại chiến hoãn khi đang nhiệm vụ', async () => {
  Object.assign(settings, { quizOn: true, quizEveryMin: 1, pollOn: true, pollEveryMin: 2, pollSec: 300, missionOn: false, missionEveryMin: 2, missionSec: 300, missionTarget: 30, duelOn: true, duelEveryMin: 1 });
  S.pts = { 'Hà Nội': 50, 'Huế': 40 }; S.roundEnd = realNow() + 1e12;
  assert.equal(quiz.quizDue(), false);   // khởi tạo mốc đếm
  startPollLoop();
  await wait(1200);   // vòng bình chọn đặt nextAt = now + 2 phút
  off += 125_000;
  pollOnChat('real1', 'hello');   // có người thật comment
  await wait(1300);
  assert.ok(pollView(), 'bình chọn phải đang chạy');
  assert.equal(quiz.quizDue(), false, 'đang bình chọn: không ra câu đố dù đã tới lượt');

  settings.pollOn = false;   // hủy bình chọn
  await wait(1300);
  assert.equal(pollView(), null);
  assert.equal(quiz.quizDue(), true, 'hết bình chọn: câu đố tới lượt');

  // nhiệm vụ: bot (S.lastAct) không đủ, phải có người thật comment
  settings.missionOn = true;
  startMissionLoop();
  await wait(1200);   // nextAt = now + 2 phút
  off += 125_000;
  S.lastAct = Date.now();   // bot / sự kiện khác cập nhật lastAct
  await wait(1300);
  assert.equal(missionView(), null, 'chưa có người thật comment: nhiệm vụ không được bắt đầu');
  off += 31_000;
  missionOnChat('real1', []);   // người thật comment
  await wait(1300);
  assert.ok(missionView(), 'có người thật: nhiệm vụ bắt đầu');
  assert.equal(quiz.quizDue(), false, 'đang nhiệm vụ: không ra câu đố');

  const realSetInterval = globalThis.setInterval;   // vòng Đại chiến không unref: nhả để tiến trình test thoát được
  globalThis.setInterval = (...a) => { const t = realSetInterval(...a); t.unref?.(); return t; };
  duel.startDuelLoop();
  globalThis.setInterval = realSetInterval;
  await wait(700);   // vòng Đại chiến đặt nextAt = now + 1 phút
  off += 61_000;
  await wait(1000);
  assert.equal(duel.duelView(), null, 'đang nhiệm vụ: Đại chiến phải hoãn');

  events.length = 0;
  settings.missionOn = false;   // hủy nhiệm vụ giữa chừng
  await wait(1300);
  assert.equal(missionView(), null);
  const end = events.find(e => e.t === 'missionEnd');
  assert.ok(end && end.cancel === true && end.won === false, 'hủy nhiệm vụ phải gửi cancel: true');
  assert.equal(events.some(e => e.t === 'missionWin'), false);

  off += 31_000;   // hết hoãn 30 giây: Đại chiến chạy
  await wait(1000);
  assert.ok(duel.duelView(), 'hết nhiệm vụ: Đại chiến bắt đầu');
  duel.stopDuel();
});

test.after(() => { Date.now = realNow; try { fs.rmSync(home, { recursive: true, force: true }); } catch {} });
