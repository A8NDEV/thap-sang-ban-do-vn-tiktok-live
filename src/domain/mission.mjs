// Nhiệm vụ cả phòng: mỗi N phút chọn 1 tỉnh, cả phòng cùng comment tên tỉnh đủ số lần trong M giây để quê đó nhận điểm thưởng.
// Logic đếm nằm ở mission-logic.mjs (thuần, có test); file này chỉ lo lịch, phát sự kiện, lời MC.
// Chỉ người thật: game.mjs đã lọc bot (isBotUid) trước khi gọi missionOnChat.
import { settings } from './settings.mjs';
import { S } from './store.mjs';
import { NAMES } from './provinces.mjs';
import { say } from '../audio/tts-queue.mjs';
import { broadcast, addLog } from '../core/bus.mjs';
import { addBonusPts, push, pushNow } from './game.mjs';   // vòng import với game.mjs: chỉ dùng bên trong hàm, an toàn
import { duelView } from './duel.mjs';
import { quizActive } from './quiz.mjs';
import { isChestActive } from './chest.mjs';
import { createMission } from './mission-logic.mjs';
import { pollView } from './poll.mjs';   // vòng import với poll.mjs: chỉ dùng bên trong hàm, an toàn

let m = null, prov = '', endsAt = 0, nextAt = 0, lastPush = 0, dirty = false;
const dyn = t => ({ t, nc: true });

export function missionView(){
  if (!m) return null;
  const now = Date.now(), v = m.view(now);
  if (!v.active) return null;
  return { active: true, label: v.label, prov, count: v.count, target: v.target, leftMs: v.leftMs, endsAt, now };
}

// chỉ gọi cho người thật; đếm khi comment có tên đúng tỉnh của nhiệm vụ
export function missionOnChat(uid, provs){
  if (!m || !Array.isArray(provs) || !provs.includes(prov)) return;
  const now = Date.now();
  if (!m.hit(uid, now)) return;
  if (now - lastPush >= 500) { lastPush = now; dirty = false; push(); } else dirty = true;
}

function startMission(now){
  prov = NAMES[Math.floor(Math.random() * NAMES.length)];
  const sec = settings.missionSec, target = settings.missionTarget;
  // trần mỗi người < target: một mình không thể tự hoàn thành nhiệm vụ
  m = createMission({ target, durationMs: sec * 1000, perUserCap: Math.max(1, Math.min(5, Math.ceil(target / 2))) });
  m.begin(now, `Comment "${prov}"`);
  endsAt = now + sec * 1000; lastPush = 0; dirty = false;
  addLog(`🎯 Nhiệm vụ ${sec} giây: comment "${prov}" đủ ${target} lần`);
  say([dyn(`Nhiệm vụ ${sec} giây! Cả phòng cùng comment ${prov} đủ ${target} lần để nhận thưởng cho quê ${prov}!`)], { tag: 'win' });
  pushNow();
}

function endMission(result, now){
  const v = m.view(now), p = prov;
  m = null; prov = ''; endsAt = 0; dirty = false;
  nextAt = now + settings.missionEveryMin * 60_000;
  if (result === 'won') {
    const pts = settings.missionPts;
    if (pts > 0) addBonusPts(p, pts);
    addLog(`🎯 Hoàn thành nhiệm vụ ${p} (${v.count}/${v.target})${pts > 0 ? ` → +${pts} điểm` : ''}`);
    broadcast({ t: 'missionWin', prov: p, count: v.count, target: v.target });
    say([dyn(pts > 0 ? `Hoàn thành nhiệm vụ! Cảm ơn bà con đã comment ${p}, quê ${p} nhận ${pts} điểm thưởng!` : `Hoàn thành nhiệm vụ! Cảm ơn bà con đã comment ${p}!`)], { tag: 'win' });
  } else if (result === 'lost') {
    addLog(`🎯 Nhiệm vụ ${p} chưa đủ (${v.count}/${v.target})`);
    broadcast({ t: 'missionEnd', won: false, count: v.count, target: v.target });
    say([dyn(`Tiếc quá, chưa đủ lần comment ${p}. Lần sau mình cố lên nhé!`)], { tag: 'win' });
  } else {   // 'cancel': tắt nhiệm vụ giữa chừng, không thưởng, không đọc
    broadcast({ t: 'missionEnd', won: false, count: v.count, target: v.target });
  }
  pushNow();
}

export function startMissionLoop(){
  setInterval(() => {
    const now = Date.now();
    if (m) {
      if (!settings.missionOn) { nextAt = 0; endMission('cancel', now); return; }
      const r = m.tick(now);
      if (r === 'won' || r === 'lost') endMission(r, now);
      else if (dirty) { dirty = false; lastPush = now; push(); }
      return;
    }
    if (!settings.missionOn) { nextAt = 0; return; }
    if (!nextAt) { nextAt = now + settings.missionEveryMin * 60_000; return; }
    if (now < nextAt) return;
    // đang có Đại chiến / câu đố / rương / bình chọn, hoặc phòng vắng 2 phút → hoãn 30 giây
    if (duelView() || quizActive() || isChestActive() || pollView() || now - (S.lastAct || 0) > 120_000) { nextAt = now + 30_000; return; }
    startMission(now);
  }, 1000).unref();
}
