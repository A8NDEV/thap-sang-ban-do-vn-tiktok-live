// TẦNG 3 — "Đại chiến": mỗi N phút, 2 tỉnh dẫn đầu vòng đua đối đầu trong M giây.
// Điểm cộng cho 2 tỉnh trong lúc đối đầu được tính riêng; bên nhiều hơn được thưởng điểm vòng đua.
import { broadcast, addLog } from '../core/bus.mjs';
import { S } from './store.mjs';
import { settings } from './settings.mjs';
import { say } from '../audio/tts-queue.mjs';
import { pushNow } from './game.mjs';

let duel = null, nextAt = 0, warned = false, midSaid = false, lastCheer = 0, cheerIdx = 0;
const dyn = t => ({ t, nc: true });
export const duelView = () => duel && { a: duel.a, b: duel.b, sa: duel.sa, sb: duel.sb, endsAt: duel.endsAt, sec: duel.sec, cp: settings.duelCmtPts, lp: settings.duelLikePts, fp: settings.duelFollowPts || 25 };
export function duelAdd(ten, n){ if (!duel) return; if (ten === duel.a) duel.sa += n; else if (ten === duel.b) duel.sb += n; }

const top2 = () => Object.entries(S.pts).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]).slice(0, 2).map(([t]) => t);
// Đại chiến = xem quê nào anh em đông vui hơn (không mang ý đánh nhau): bình luận + thả tim + follow để cộng điểm cho quê
const how = () => `Bình luận, thả tim và bấm follow kênh cho quê mình nhé: mỗi bình luận cộng ${settings.duelCmtPts} điểm, mỗi tim cộng ${settings.duelLikePts} điểm, và bấm follow kênh cộng ngay ${settings.duelFollowPts || 25} điểm!`;
const lines = () => ({
  start: `Trong ${settings.duelSec} giây, quê nào nhiều điểm hơn được thưởng ${settings.duelBonus} điểm!`,
  win: `có anh em đông vui hơn, được thưởng ${settings.duelBonus} điểm!`,
});
const CHEER = [
  'Anh em hai quê vừa bình luận vừa thả tim liên tục nào, xem bên nào đông hơn!',
  'Thả tim thật nhiều cho quê mình đi bà con, mỗi tim là một điểm đó!',
  'Bấm nút Follow kênh ngay để cộng tới 25 điểm kéo co cho quê mình bà con ơi!',
  'Ai chưa follow kênh thì bấm Follow ngay nào, một lượt follow kéo điểm cực mạnh!',
  'Bình luận gì cũng được, mỗi bình luận là cộng điểm cho quê mình!',
  'Rủ đồng hương vào phòng cùng thả tim và follow, quê nào đông người hơn sẽ thắng!',
];
export const duelStaticLines = () => ['Đại chiến bắt đầu!', 'và', 'Xem quê nào anh em đông vui hơn nhé!', how(), lines().start, 'Hết giờ đại chiến!', lines().win, 'Hai quê hòa nhau, không ai được thưởng!', 'Còn mười giây đại chiến!', 'Bình luận, thả tim nhanh lên nào!', ...CHEER];
// MC rảnh trong lúc Đại chiến: khều bình luận / thả tim (thay câu nói vu vơ), ≥ 7 giây một câu
export function duelIdleLine(){
  if (!duel || Date.now() - lastCheer < 7000) return null;
  lastCheer = Date.now();
  const lead = duel.sa === duel.sb ? null : duel.sa > duel.sb ? [duel.a, duel.b] : [duel.b, duel.a];
  if (cheerIdx++ % 2 && lead) return [dyn(`${lead[0]} đang nhỉnh hơn ${lead[1]}.`), `${lead[1]} ơi, bình luận, thả tim kéo lại nào!`];
  return [CHEER[cheerIdx % CHEER.length]];
}

export function startDuel(a, b){
  if (duel) return { ok: false, error: 'Đang có đại chiến' };
  if (!a || !b) { [a, b] = top2(); }
  if (!a || !b || a === b) return { ok: false, error: 'Cần ít nhất 2 tỉnh có điểm trong vòng đua' };
  duel = { a, b, sa: 0, sb: 0, sec: settings.duelSec, endsAt: Date.now() + settings.duelSec * 1000 }; warned = false; midSaid = false; lastCheer = Date.now();
  addLog(`⚔️ Đại chiến: ${a} đối đầu ${b} (${settings.duelSec} giây)`);
  broadcast({ t: 'duelStart', a, b, sec: settings.duelSec });
  say(['Đại chiến bắt đầu!', `${a}.`, 'và', `${b}.`, 'Xem quê nào anh em đông vui hơn nhé!', how(), lines().start], { tag: 'win' });
  pushNow();
  return { ok: true, a, b };
}
function endDuel(){
  const d = duel; duel = null; nextAt = Date.now() + settings.duelEveryMin * 60_000;
  const w = d.sa > d.sb ? d.a : d.sb > d.sa ? d.b : null;
  if (w) { S.pts[w] = (S.pts[w] || 0) + settings.duelBonus; if (!S.roundEnd) S.roundEnd = Date.now() + settings.roundMin * 60_000; }
  addLog(`⚔️ Hết đại chiến: ${d.a} ${d.sa} – ${d.sb} ${d.b}${w ? ` → ${w} +${settings.duelBonus}` : ' (hòa)'}`);
  broadcast({ t: 'duelEnd', a: d.a, b: d.b, sa: d.sa, sb: d.sb, winner: w, bonus: settings.duelBonus });
  say(w ? ['Hết giờ đại chiến!', `${w}.`, lines().win] : ['Hết giờ đại chiến!', 'Hai quê hòa nhau, không ai được thưởng!'], { tag: 'win' });
  pushNow();
}
export function stopDuel(){ if (duel) endDuel(); }

export function startDuelLoop(){
  setInterval(() => {
    const now = Date.now();
    if (duel) {
      const left = duel.endsAt - now;
      if (!midSaid && left <= duel.sec * 500 && left > 15_000) { midSaid = true; lastCheer = now; say([dyn(`Đại chiến đã được nửa thời gian, ${duel.a} ${duel.sa} điểm, ${duel.b} ${duel.sb} điểm.`), how()], { tag: 'win' }); }
      if (!warned && left <= 10_000 && left > 8_000) {
        warned = true;
        const lead = duel.sa === duel.sb ? null : duel.sa > duel.sb ? [duel.a, duel.sa - duel.sb] : [duel.b, duel.sb - duel.sa];
        say(['Còn mười giây đại chiến!', ...(lead ? [dyn(`${lead[0]} đang hơn ${lead[1]} điểm!`)] : []), 'Bình luận, thả tim nhanh lên nào!'], { tag: 'win' });
      }
      if (left <= 0) endDuel();
      return;
    }
    if (!settings.duelOn) { nextAt = 0; return; }
    if (!nextAt) { nextAt = now + settings.duelEveryMin * 60_000; return; }
    if (now < nextAt) return;
    // vòng đua sắp hết → hoãn, không để đại chiến cắt ngang lúc công bố thắng
    if (!S.roundEnd || S.roundEnd - now < (settings.duelSec + 15) * 1000 || top2().length < 2) { nextAt = now + 30_000; return; }
    startDuel();
  }, 500);
}
