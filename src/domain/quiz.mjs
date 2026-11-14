// TẦNG 3 — "Câu đố": MC rảnh (không có ai thắp đèn / tặng quà cần đọc) thì cứ N phút ra một câu đố lịch sử / tỉnh thành.
// Người comment đúng đầu tiên được cộng quizPts điểm cho quê; người đúng sau được 1/5 số đó. Đúng đầu tiên → còn tối đa 15 giây cho người khác.
import { broadcast, addLog } from '../core/bus.mjs';
import { norm } from '../ingest/sanitize.mjs';
import { settings } from './settings.mjs';
import { QUIZ } from './quiz-bank.mjs';
import { say } from '../audio/tts-queue.mjs';
import { awardPts, pushNow, dyn } from './game.mjs';
import { duelView } from './duel.mjs';

// đáp án 1 chữ (Lý, Trần, tỏi…) chỉ tính khi bình luận ngắn — tránh "vô lý" thành đúng
const PREP = QUIZ.map(x => ({ ...x, n: x.a.map(a => ({ k: norm(a), short: norm(a).trim().split(' ').length === 1 })) }));
export const QUIZ_LINES = {
  start: 'Câu đố vui!',
  rule: 'Comment đáp án, ai trả lời đúng đầu tiên được cộng điểm cho quê nhà!',
  first: 'trả lời đúng đầu tiên!',
  again: 'Nhắc lại câu đố.',
  nudge: 'Bà con comment đáp án đi nào, ai đúng đầu tiên được cộng điểm cho quê!',
  ten: 'Còn mười giây trả lời câu đố!',
  none: 'Chưa ai trả lời đúng, câu sau cố lên nhé!',
};
export const quizStaticLines = () => [...Object.values(QUIZ_LINES), ...QUIZ.map(x => x.q), ...QUIZ.map(x => `Hết giờ! Đáp án đúng là ${x.s}.`)];

let cur = null, sinceAt = 0, bag = [];   // sinceAt: mốc tính giãn cách (câu trước kết thúc) — đổi quizEveryMin là áp dụng ngay
const pickIdx = () => { if (!bag.length) bag = [...QUIZ.keys()].sort(() => Math.random() - .5); return bag.pop(); };

export const quizActive = () => !!cur && !cur.done;
export const quizView = () => cur && {
  q: cur.q, sec: cur.sec, endsAt: cur.endsAt, n: cur.right.length, done: cur.done, answer: cur.done ? cur.s : '',
  first: cur.right[0] ? { name: cur.right[0].name, avatar: cur.right[0].avatar, prov: cur.right[0].prov, pts: cur.right[0].pts } : null,
};
// tới lượt câu đố chưa (startMC hỏi khi MC đang rảnh)
export function quizDue(){
  const now = Date.now();
  if (!settings.quizOn || cur || duelView()) return false;
  if (!sinceAt) { sinceAt = now; return false; }
  return now >= sinceAt + settings.quizEveryMin * 60_000;
}

export function startQuiz(idx){
  if (quizActive()) return { ok: false, error: 'Đang có câu đố' };
  const i = Number.isInteger(idx) && PREP[idx] ? idx : pickIdx(), Q = PREP[i];
  cur = { i, q: Q.q, s: Q.s, n: Q.n, sec: settings.quizSec, endsAt: Date.now() + settings.quizSec * 1000 + 6000, right: [], seen: new Set(), done: false, warned: false, again: false };   // +6 giây: thời gian MC đọc câu hỏi
  addLog(`❓ Câu đố: ${Q.q} (đáp án: ${Q.s})`);
  broadcast({ t: 'quizStart', q: Q.q, sec: settings.quizSec });
  say([QUIZ_LINES.start, Q.q, QUIZ_LINES.rule], { tag: 'quiz' });
  pushNow();
  return { ok: true, q: Q.q, answer: Q.s };
}

const isRight = text => { const t = norm(text), words = t.trim().split(' ').length; return cur.n.some(a => t.includes(a.k) && (!a.short || words <= 4)); };
// gọi từ onChat trước khi xử lý tên tỉnh: trả true = bình luận là đáp án đúng (không thắp đèn theo nó)
export function quizAnswer(uid, name, avatar, text){
  if (!quizActive() || !isRight(text)) return false;
  if (cur.seen.has(uid)) return true;           // đã đúng rồi: không cộng lại, cũng không đổi quê
  cur.seen.add(uid);
  const firstOne = !cur.right.length, pts = firstOne ? settings.quizPts : Math.max(1, Math.round(settings.quizPts / 5));
  const prov = awardPts(uid, name, avatar, pts);
  const r = { name, avatar: avatar || '', prov, pts };
  cur.right.push(r);
  addLog(`✅ ${name} trả lời đúng${firstOne ? ' đầu tiên' : ''} +${pts}${prov ? ' → ' + prov : ' (chưa có quê, giữ điểm)'}`);
  broadcast({ t: 'quizRight', ...r, first: firstOne, n: cur.right.length });
  if (firstOne) {
    cur.endsAt = Math.min(cur.endsAt, Date.now() + 15_000);
    say([name, QUIZ_LINES.first, prov ? dyn(`Cộng ${pts} điểm cho ${prov}.`) : dyn(`Comment tên tỉnh quê bạn để nhận ${pts} điểm nhé.`)], { tag: 'quiz' });
  }
  pushNow();
  return true;
}

function endQuiz(){
  const c = cur; c.done = true; c.endsAt = Date.now() + 8000;   // hiện đáp án thêm 8 giây rồi ẩn
  sinceAt = Date.now();
  addLog(`❓ Hết câu đố: ${c.right.length} người đúng`);
  broadcast({ t: 'quizEnd', answer: c.s, n: c.right.length });
  say([`Hết giờ! Đáp án đúng là ${c.s}.`, c.right.length ? dyn(`Có ${c.right.length} bạn trả lời đúng.`) : QUIZ_LINES.none], { tag: 'quiz' });
  pushNow();
}
export function stopQuiz(){ if (quizActive()) endQuiz(); else if (cur) { cur = null; pushNow(); } }

// MC rảnh trong lúc đang có câu đố: nhắc lại câu hỏi 1 lần, sau đó khều trả lời
export function quizIdleLine(){
  if (!quizActive()) return null;
  if (!cur.again && cur.endsAt - Date.now() > 14_000) { cur.again = true; return [QUIZ_LINES.again, cur.q]; }
  return [QUIZ_LINES.nudge];
}

export function startQuizLoop(){
  setInterval(() => {
    if (!cur) return;
    const left = cur.endsAt - Date.now();
    if (cur.done) { if (left <= 0) { cur = null; pushNow(); } return; }
    if (!cur.warned && !cur.right.length && left <= 10_000 && left > 7_000) { cur.warned = true; say([QUIZ_LINES.ten], { tag: 'quiz' }); }
    if (left <= 0) endQuiz();
  }, 500);
}
