// mcGiftCta chỉ đổi LỜI MC: câu đọc khi lên cấp bỏ phần "Còn N xu nữa lên …", còn sự kiện gửi overlay luôn đủ next / need / lvNext / lvNeed.
// Chạy trong thư mục dữ liệu tạm (APP_HOME) để không ghi vào data/ thật.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tsbd-test-'));
process.env.APP_HOME = home;
fs.mkdirSync(path.join(home, 'data'), { recursive: true });

const { setBroadcaster } = await import('../src/core/bus.mjs');
const { settings } = await import('../src/domain/settings.mjs');
const { S, fans } = await import('../src/domain/store.mjs');
const { _setPrepare } = await import('../src/audio/tts-queue.mjs');
const { textOf } = await import('../src/audio/tts-engine.mjs');
const { onGift } = await import('../src/domain/game.mjs');

const spoken = [], events = [];
setBroadcaster(m => events.push(m));
_setPrepare(async parts => { spoken.push(textOf(parts)); return { url: 'x', bytes: 600, sec: 0.01 }; });

async function giftOnce(cta, uid){
  settings.mcGiftCta = cta; settings.levelOn = true; settings.overtakeOn = true;
  spoken.length = 0; events.length = 0;
  fans[uid] = { name: 'Lan', home: 'Hà Nội', seen: Date.now() };
  onGift(uid, 'Lan', 'Tim ngón tay', 1, 15, '');   // 15 xu → cấp Đồng, còn xu để lên Bạc
  await new Promise(r => setTimeout(r, 1200));
  return { spoken: [...spoken], events: [...events] };
}

test('lên cấp: lời MC theo mcGiftCta, sự kiện luôn đủ next/need', async () => {
  S.donors = {}; S.pts = {}; S.gifts = {};
  const on = await giftOnce(true, 'u_on');
  S.donors = {};
  const off = await giftOnce(false, 'u_off');
  const lvSpoken = r => r.spoken.find(t => /lên cấp/.test(t)) || '';
  assert.match(lvSpoken(on), /lên cấp Đồng! Còn \d+ xu nữa lên/);
  assert.match(lvSpoken(off), /lên cấp Đồng!/);
  assert.doesNotMatch(lvSpoken(off), /xu nữa lên|Còn/);
  for (const r of [on, off]) {
    const lu = r.events.find(e => e.t === 'levelUp'), g = r.events.find(e => e.t === 'gift');
    assert.ok(lu && lu.next && lu.need > 0, 'levelUp phải đủ next/need');
    assert.ok(g && g.lvNext && g.lvNeed > 0, 'gift phải đủ lvNext/lvNeed');
  }
});

test.after(() => { try { fs.rmSync(home, { recursive: true, force: true }); } catch {} });
