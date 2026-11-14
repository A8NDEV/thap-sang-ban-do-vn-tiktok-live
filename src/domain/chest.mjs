// TẦNG 3 — Sự kiện "Rương Vàng Bí Ẩn" (Lucky Golden Chest)
// Rương thần kỳ rơi xuống 1 tỉnh ngẫu nhiên kèm đếm ngược và thanh năng lượng mở rương.
// Bình luận tên tỉnh (+1) hoặc tặng quà (+xu/2) để tích lũy năng lượng mở rương.
// Khi đầy năng lượng: Rương nổ tung rực rỡ, thưởng lớn điểm vòng đua và vinh danh!

import { broadcast, addLog } from '../core/bus.mjs';
import { S } from './store.mjs';
import { say } from '../audio/tts-queue.mjs';
import { addBonusPts } from './game.mjs';
import { NAMES } from './provinces.mjs';
import { settings } from './settings.mjs';

let chest = null;
let tickTimer = null;

export const chestView = () => chest && {
  prov: chest.prov,
  energy: chest.energy,
  maxEnergy: chest.maxEnergy,
  sec: chest.sec,
  endsAt: chest.endsAt,
  bonusPts: chest.bonusPts,
};

export function isChestActive(){
  return !!chest;
}

export function chestAdd(ten, amount, name){
  if (!chest || chest.prov !== ten) return;
  chest.energy = Math.min(chest.maxEnergy, chest.energy + amount);
  if (name) {
    chest.contributors[name] = (chest.contributors[name] || 0) + amount;
  }
  const pct = Math.round((chest.energy / chest.maxEnergy) * 100);
  broadcast({
    t: 'chestUpdate',
    prov: chest.prov,
    energy: chest.energy,
    maxEnergy: chest.maxEnergy,
    pct,
    contributor: name,
    amount,
  });

  if (chest.energy >= chest.maxEnergy) {
    openChest(true);
  }
}

export function startChest(provName, opts = {}){
  if (chest) return { ok: false, error: 'Đang có Rương Vàng trên bản đồ' };

  let prov = provName;
  if (!prov) {
    const withPts = Object.keys(S.pts).filter(t => S.pts[t] > 0);
    if (withPts.length > 0 && Math.random() < 0.6) {
      prov = withPts[Math.floor(Math.random() * withPts.length)];
    } else {
      prov = NAMES[Math.floor(Math.random() * NAMES.length)];
    }
  }

  const sec = opts.sec || 45;
  const maxEnergy = opts.maxEnergy || 35;
  const bonusPts = opts.bonusPts || 3000;

  chest = {
    prov,
    energy: 0,
    maxEnergy,
    sec,
    endsAt: Date.now() + sec * 1000,
    bonusPts,
    contributors: {},
  };

  addLog(`🎁 Rương Vàng May Mắn xuất hiện tại ${prov}! Cần ${maxEnergy} năng lượng trong ${sec}s để mở!`);
  broadcast({
    t: 'chestDrop',
    prov,
    sec,
    energy: 0,
    maxEnergy,
    bonusPts,
    endsAt: chest.endsAt,
  });

  say([
    'Rương Vàng Thần Kỳ xuất hiện!',
    `tại ${prov}.`,
    settings.mcGiftCta ? `Bà con ${prov} hãy bình luận và tặng quà để mở rương nhận thưởng ${bonusPts} điểm!` : `Bà con ${prov} hãy bình luận tên tỉnh để mở rương nhận thưởng ${bonusPts} điểm!`,
  ], { tag: 'win' });

  clearInterval(tickTimer);
  tickTimer = setInterval(() => {
    if (!chest) { clearInterval(tickTimer); return; }
    if (Date.now() >= chest.endsAt) {
      if (chest.energy >= Math.round(chest.maxEnergy * 0.6)) {
        openChest(true);
      } else {
        openChest(false);
      }
    }
  }, 1000);

  return { ok: true, prov, sec, maxEnergy, bonusPts };
}

export function openChest(success){
  if (!chest) return;
  const c = chest;
  clearInterval(tickTimer);
  chest = null;

  if (success) {
    let topName = '';
    let maxCont = 0;
    for (const [nm, cnt] of Object.entries(c.contributors)) {
      if (cnt > maxCont) { maxCont = cnt; topName = nm; }
    }

    addBonusPts(c.prov, c.bonusPts);
    addLog(`✨ RƯƠNG VÀNG ĐÃ NỔ! ${c.prov} nhận +${c.bonusPts} điểm thưởng${topName ? ' (công đầu: ' + topName + ')' : ''}!`);

    broadcast({
      t: 'chestOpen',
      prov: c.prov,
      bonusPts: c.bonusPts,
      topName: topName || 'Bà con ' + c.prov,
      success: true,
    });

    say([
      'Chúc mừng bà con',
      `${c.prov}!`,
      'Rương Vàng đã nổ tung!',
      `Cộng ngay ${c.bonusPts} điểm cho quê ${c.prov}!`,
      ...(topName ? ['Cảm ơn', topName, 'đã góp công lớn nhất!'] : []),
    ], { tag: 'win' });
  } else {
    addLog(`⏱️ Hết giờ mở Rương Vàng tại ${c.prov} (chưa đủ năng lượng).`);
    broadcast({
      t: 'chestEnd',
      prov: c.prov,
      success: false,
    });
  }
}

export function stopChest(){
  if (!chest) return { ok: false, error: 'Không có rương nào đang mở' };
  clearInterval(tickTimer);
  const prov = chest.prov;
  chest = null;
  broadcast({ t: 'chestEnd', prov, success: false });
  addLog('⏹️ Đã hủy sự kiện Rương Vàng');
  return { ok: true };
}

