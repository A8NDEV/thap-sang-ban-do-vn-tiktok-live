// Bình chọn nhanh A/B/C: mỗi N phút hỏi 1 câu vui, cả phòng comment A/B/C trong M giây, MC đọc kết quả.
// Logic đếm nằm ở poll-logic.mjs (thuần, có test); file này chỉ lo lịch, phát sự kiện, lời MC.
// Chỉ người thật: game.mjs đã lọc bot (isBotUid) trước khi gọi pollOnChat.
import { settings } from './settings.mjs';
import { say } from '../audio/tts-queue.mjs';
import { broadcast, addLog } from '../core/bus.mjs';
import { push, pushNow, dyn } from './game.mjs';   // vòng import với game.mjs / mission.mjs: chỉ dùng bên trong hàm, an toàn
import { duelView } from './duel.mjs';
import { quizActive } from './quiz.mjs';
import { isChestActive } from './chest.mjs';
import { missionView } from './mission.mjs';
import { createPoll } from './poll-logic.mjs';
import { pickPoll } from './poll-bank.mjs';
import { pickIndex, pollStartLine, POLL_WIN_LINES, POLL_TIE_LINES } from './engage-lines.mjs';

let p = null, nextAt = 0, endsAt = 0, lastPush = 0, dirty = false;
let lastReal = 0;               // lần cuối có người THẬT comment (không dùng S.lastAct vì bot cũng cập nhật)
const recent = [];              // câu hỏi đã dùng gần đây (văn bản), cũ nhất trước, giữ 8
let lastWin = -1, lastTie = -1;

export function pollView(){
  if (!p) return null;
  const now = Date.now(), v = p.view(now);
  if (!v.active) return null;
  return { active: true, question: v.question, options: v.options, counts: v.counts, pct: v.pct, total: v.total, leftMs: v.leftMs, endsAt, now };
}

// chỉ gọi cho người thật
export function pollOnChat(uid, text){
  const now = Date.now();
  lastReal = now;
  if (!p || !p.vote(uid, text, now)) return;
  if (now - lastPush >= 500) { lastPush = now; dirty = false; push(); } else dirty = true;
}

function startPoll(now){
  const { q, options } = pickPoll(Math.random, recent);
  recent.push(q); while (recent.length > 8) recent.shift();
  const sec = settings.pollSec;
  p = createPoll({ options, durationMs: sec * 1000 });
  p.begin(now, q);
  endsAt = now + sec * 1000; lastPush = 0; dirty = false;
  addLog(`📊 Bình chọn ${sec} giây: ${q} (${options.join(' / ')})`);
  say([dyn(pollStartLine(q, options, sec))], { tag: 'win' });
  pushNow();
}

function endPoll(cancel, now){
  const cur = p, v = cur.view(now), r = cancel ? null : cur.result();
  p = null; endsAt = 0; dirty = false;
  nextAt = now + settings.pollEveryMin * 60_000;
  if (cancel || !r) {   // tắt bình chọn giữa chừng: không công bố, không đọc
    broadcast({ t: 'pollEnd', cancel: true });
  } else {
    broadcast({ t: 'pollEnd', question: v.question, options: v.options, winner: r.winner, tie: r.tie, counts: r.counts, total: r.total });
    if (r.total === 0) addLog(`📊 Bình chọn "${v.question}" không có phiếu nào`);
    else if (r.tie) {
      addLog(`📊 Bình chọn "${v.question}": hòa (${r.counts.join('-')})`);
      lastTie = pickIndex(POLL_TIE_LINES.length, lastTie);
      say([dyn(POLL_TIE_LINES[lastTie]())], { tag: 'win' });
    } else {
      const w = v.options[r.winner];
      addLog(`📊 Bình chọn "${v.question}": ${w} thắng (${r.counts.join('-')})`);
      lastWin = pickIndex(POLL_WIN_LINES.length, lastWin);
      say([dyn(POLL_WIN_LINES[lastWin](w, v.pct[r.winner]))], { tag: 'win' });
    }
  }
  pushNow();
}

export function startPollLoop(){
  setInterval(() => {
    const now = Date.now();
    if (p) {
      if (!settings.pollOn) { nextAt = 0; endPoll(true, now); return; }
      const r = p.tick(now);
      if (r === 'done') endPoll(false, now);
      else if (dirty) { dirty = false; lastPush = now; push(); }
      return;
    }
    if (!settings.pollOn) { nextAt = 0; return; }
    if (!nextAt) { nextAt = now + settings.pollEveryMin * 60_000; return; }
    if (now < nextAt) return;
    // đang có Đại chiến / câu đố / rương / nhiệm vụ, hoặc 2 phút chưa có người thật comment → hoãn 30 giây
    if (duelView() || quizActive() || isChestActive() || missionView() || now - lastReal > 120_000) { nextAt = now + 30_000; return; }
    startPoll(now);
  }, 1000).unref();
}
