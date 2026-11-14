// TẦNG 4 — kịch bản MC: chào người mới, câu nói lúc vắng, tải sẵn giọng câu cố định.
import fs from 'node:fs';
import path from 'node:path';
import { addLog, pick } from '../core/bus.mjs';
import { CACHE_DIR } from '../core/paths.mjs';
import { S } from '../domain/store.mjs';
import { settings, tiers, fmtXu } from '../domain/settings.mjs';
import { NAMES, INFO, ISLAND_LINE, ISLAND_IDLE, factOf } from '../domain/provinces.mjs';
import { GIFT_NAMES } from '../ingest/gift-prices.mjs';
import { sortObj, raceTail, joinBuf, joined, dyn } from '../domain/game.mjs';
import { say, isBusy, lastSpokenUntil } from './tts-queue.mjs';
import { duelStaticLines, duelIdleLine, duelView } from '../domain/duel.mjs';
import { quizDue, startQuiz, quizIdleLine, quizStaticLines } from '../domain/quiz.mjs';
import { FAKE_TTS, synthesizeTTS, ttsOpts, cacheName, cachedFile, writeCache, stripOi } from './tts-engine.mjs';
import { effectiveIdleGapSec, ctaAllowed, isFollowLikeCta, isGiftSolicitation, filterIdleLines, createSpokenMemory } from '../domain/safe.mjs';
import { createInteractPicker, allInteractLines } from './mc-interact.mjs';

const bags = {};
function bagPick(key, arr){ let b = bags[key]; if (!b || !b.length) { b = bags[key] = [...arr].sort(() => Math.random() - .5); } return b.pop(); }

/* ---------- chào người vào phòng ---------- */
const GREET_TAIL = [
  'ơi, chào mừng bạn! Comment tên tỉnh quê bạn để thắp sáng quê mình trên bản đồ nhé.',
  'ơi, chào bạn! Quê bạn ở đâu, comment tên tỉnh để thắp một ngọn đèn nhé.',
  'ơi, chào mừng bạn vào phòng! Mời bạn thắp sáng quê hương mình, chỉ cần comment tên tỉnh.',
  'ơi, chào bạn nha! Quê bạn đã sáng đèn chưa? Comment tên quê để thắp sáng ngay.',
  'ơi, chào mừng bạn! Mời bạn góp một ngọn đèn cho quê nhà, comment tên tỉnh là được.',
];
const GREET_MANY = [
  'ơi, chào mừng các bạn! Mời các bạn comment tên tỉnh để thắp sáng quê mình nhé.',
  'ơi, chào cả nhà! Quê các bạn ở đâu, comment tên tỉnh để thắp đèn nào.',
  'ơi, chào mừng các bạn vào phòng! Mời các bạn thắp sáng quê hương trên bản đồ.',
];
function greetLine(){
  const now = Date.now();
  while (joinBuf.length && now - joinBuf[0].at > 90_000) joinBuf.shift();     // vào quá lâu rồi thì thôi chào
  if (!joinBuf.length) return null;
  const g = joinBuf.splice(0, 3).map(j => j.name);
  if (g.length === 1) return [g[0], bagPick('greet1', GREET_TAIL)];
  return [...g.slice(0, -1), 'và', g[g.length - 1], bagPick('greetN', GREET_MANY)];   // từng tên là một đoạn (đã tạo sẵn)
}

/* ---------- câu nói lúc vắng ---------- */
function donateLines(){
  const T = tiers(), [a, b, c] = T, full = settings.fullCoins;
  const L = [
    'Muốn quê mình thắng vòng đua thì một bông hồng cũng giúp được đó bà con.',
    'Mỗi món quà là một ngọn đèn sáng hơn cho quê hương mình.',
    'Quê nào nhận nhiều quà nhất sẽ được ghi tên trên bảng Quê nhận nhiều quà suốt buổi live.',
    'Ai tặng nhiều nhất sẽ được đứng trên bục vinh danh cuối màn hình nhé.',
    'Comment là được 1 điểm, còn tặng quà thì điểm nhân lên gấp nhiều lần, quê bạn bứt lên ngay.',
    'Đồng hương ơi, quê mình đang cần điểm, tặng một món quà nhỏ để kéo quê lên nào!',
    'Thả một bông hồng cho quê nhà, đèn quê bạn sẽ nháy sáng ngay trên bản đồ.',
    'Mỗi lần bạn tặng quà, camera sẽ bay tới quê bạn và ngọn đèn sẽ nháy sáng cho cả phòng cùng thấy.',
  ];
  if (a) L.push(`Tặng một bông hồng ${a[0]} xu là quê bạn được cộng ${a[1]} điểm ngay.`);
  if (b) L.push(`Quà từ ${b[0]} xu được cộng hẳn ${b[1]} điểm, gấp ${Math.round(b[1] / Math.max(1, a[1]))} lần bông hồng đó.`, `Tim ngón tay ${b[0]} xu thôi là quê bạn có ${b[1]} điểm rồi.`);
  if (c) L.push(`Quà từ ${c[0]} xu được cộng luôn ${c[1]} điểm, đủ đưa quê bạn lên top!`, `Một chiếc bánh donut ${c[0]} xu là quê bạn có ngay ${c[1]} điểm.`);
  if (full) L.push(`Ai tặng đủ ${fmtXu(full)} xu sẽ thắp sáng cả nước, 34 tỉnh, thành rực sáng cùng lúc, tên bạn hiện to giữa màn hình!`, `Cả nước đang chờ một người thắp sáng tất cả, chỉ cần ${fmtXu(full)} xu là 34 tỉnh, thành cùng rực sáng.`);
  return L;
}
const INVITE = [
  'Bà con comment tên tỉnh, thành quê mình để thắp một ngọn đèn trên bản đồ Việt Nam nhé.',
  'Bà con đang xem live bấm nút Follow kênh để nhận điểm thưởng và cùng nhau thắp sáng trọn vẹn bản đồ Việt Nam nhé!',
  'Bấm Follow kênh ngay nha bà con, mỗi lượt follow cộng ngay 20 điểm cho quê mình đó!',
  'Sau sáp nhập, cả nước còn 34 tỉnh, thành. Bạn gõ tên tỉnh cũ hay tên thành phố quen thuộc cũng được, mình nhận ra hết.',
  'Quê bạn đã sáng đèn chưa? Comment tên quê ngay để thắp sáng nhé.',
  'Rủ bạn bè đồng hương vào thắp đèn để quê mình dẫn đầu vòng đua nào.',
  'Gõ không dấu cũng được nha, Sài Gòn, Đà Lạt, Nha Trang, Phú Quốc, mình đều biết thuộc tỉnh nào.',
  'Mỗi comment là 1 điểm cho quê bạn, comment càng nhiều quê càng sáng.',
  'Ai ở xa quê thì comment tên quê để thắp một ngọn đèn cho quê nhà nhé.',
  'Bấm theo dõi kênh để tối nào cũng vào thắp đèn cho quê mình nhé.',
];
const CALLOUT = ['ơi, quê bạn ở đâu? Comment tên tỉnh để thắp sáng quê mình nhé!', 'ơi, mời bạn thắp một ngọn đèn cho quê hương, comment tên tỉnh là được.', 'ơi, quê bạn chưa sáng đèn đâu, comment tên quê đi nào!'];
let idleIdx = 0;
// Khi TẮT "MC kêu gọi tặng quà" (settings.mcGiftCta = false → chế độ an toàn): không đọc câu kêu gọi / hứa thưởng quà;
// các suất 'donate' đổi thành câu mời thả tim / follow / bình luận / chia sẻ (cách nhau ≥ 75 giây); một câu không lặp lại trong 30 phút.
// Bật mcGiftCta → hành vi y như trước.
const idleMem = createSpokenMemory(30 * 60_000);
const interactPicker = createInteractPicker();
const interactParts = new WeakSet();
let lastInteractAt = 0;
export function resetIdleMemory(){ idleMem.clear(); interactPicker.reset(); lastInteractAt = 0; }
const partText = p => (p && typeof p === 'object' ? p.t : p);
const lineKey = parts => parts.map(partText).join(' ');
export function idleLine(){
  const safe = !settings.mcGiftCta;
  if (!safe) return pickIdle(false);
  const now = Date.now();
  for (let i = 0; i < 16; i++) {                // thử lần lượt các loại câu cho tới khi gặp câu hợp lệ và chưa nói trong 30 phút
    const parts = pickIdle(true, now);
    if (!parts) return null;
    if (parts.some(p => isGiftSolicitation(partText(p)))) continue;   // chốt chặn cuối: tuyệt đối không đọc câu chèo kéo quà
    const key = lineKey(parts);
    if (idleMem.recent(key, now)) continue;
    idleMem.mark(key, now);
    if (interactParts.has(parts)) lastInteractAt = now;
    return parts;
  }
  return null;                                   // hết câu mới thì im lặng, không lặp
}
function pickIdle(safe, now = Date.now()){
  const kinds = ['donate', 'race', 'callout', 'unlit', 'donate', 'invite', 'callout', 'lead', 'donate', 'fact', 'topdonor', 'callout', 'donate', 'unlit', 'island', 'invite'];
  for (let k = 0; k < kinds.length; k++) {
    const k0 = kinds[idleIdx++ % kinds.length], kind = safe && k0 === 'donate' ? 'interact' : k0;
    if (kind === 'interact') {
      if (!ctaAllowed(lastInteractAt, now, true, 75_000)) continue;     // hai câu mời tương tác cách nhau ≥ 75 giây
      const parts = [interactPicker.next().line]; interactParts.add(parts); return parts;
    }
    if (kind === 'donate') return [bagPick('donate', donateLines())];
    if (kind === 'invite') {
      const pool = filterIdleLines(safe ? INVITE.filter(l => !isFollowLikeCta(l)) : INVITE, safe);   // an toàn: lời mời follow / thả tim đã nằm trong nhóm 'interact'
      if (!pool.length) continue;
      return [bagPick(safe ? 'invite-safe' : 'invite', pool)];
    }
    if (kind === 'island') return [ISLAND_IDLE];
    if (kind === 'unlit') {
      const un = NAMES.filter(n => !S.lit[n]);
      if (!un.length) continue;
      const ex = un.sort(() => Math.random() - .5).slice(0, 3);
      return [dyn(`Còn ${un.length} tỉnh, thành chưa sáng đèn, như ${ex.join(', ')}.`), 'Ai quê ở đó vào thắp đèn đi nào!'];
    }
    if (kind === 'lead') {
      const top = sortObj(S.pts, 2);
      if (!top.length) continue;
      const left = Math.max(0, Math.round((S.roundEnd - Date.now()) / 60_000));
      return [dyn(`Vòng đua ${left ? `còn khoảng ${left} phút` : 'sắp hết giờ'}, ${top[0][0]} đang dẫn đầu với ${top[0][1]} điểm.`), top[1] ? dyn(`${top[1][0]} theo sau với ${top[1][1]} điểm.`) : 'Các quê khác cố lên nào!'];
    }
    if (kind === 'race') {
      if (safe) continue;       // câu thứ hai "tặng quà kéo quê mình lên nào" là kêu gọi quà
      const top = sortObj(S.pts, 3);
      if (top.length < 2) continue;
      const t = pick(top.slice(1))[0];
      return [{ t: raceTail(t), nc: true }, 'Đồng hương ơi, tặng quà kéo quê mình lên nào!'];
    }
    if (kind === 'callout') {      // gọi tên người mới vào mà chưa thắp đèn
      const now = Date.now();
      const c = [...joined.entries()].filter(([u, j]) => !j.called && !S.who[u] && now - j.at > 20_000 && now - j.at < 15 * 60_000).pop();
      if (!c) continue;
      c[1].called = true;
      return [c[1].name, bagPick('callout', CALLOUT)];
    }
    if (kind === 'topdonor') {
      if (safe) continue;       // xếp hạng người tặng + "ai sẽ vượt lên đứng đầu bục vinh danh" là kích thích tặng quà
      const d = Object.values(S.donors).sort((a, b) => b.coins - a.coins)[0];
      if (!d) continue;
      return ['Cảm ơn', d.name, dyn(`đang là người thắp nhiều đèn nhất đêm nay với ${d.coins} xu.`), 'Ai sẽ vượt lên đứng đầu bục vinh danh đây?'];
    }
    if (kind === 'fact') { const ten = pick(NAMES); return ['Bạn có biết?', `${ten}.`, factOf(ten)]; }
  }
  return safe ? null : [bagPick('donate', donateLines())];
}

// MC không để im: đọc xong câu nào là chào người mới vào, không ai thì nói câu tiếp
export function startMC(){
  setInterval(() => {
    if (isBusy()) return;
    // chào người mới vào là việc đang xảy ra → nối ngay sau câu trước (0,3 giây), không đợi khoảng nghỉ của câu nói vu vơ
    const quiet = Date.now() - lastSpokenUntil;
    if (quiet < 300) return;
    if (settings.greetJoin && joinBuf.length) { const g = greetLine(); if (g) return say(g, { tag: 'greet' }); }
    if (quiet < settings.idleGapSec * 1000) return;
    if (duelView()) { const dl = duelIdleLine(); if (dl) say(dl, { tag: 'idle' }); return; }   // đang Đại chiến: chỉ khều bình luận / thả tim
    if (quizDue()) return void startQuiz();          // MC rảnh + tới lượt → ra câu đố xen kẽ
    const ql = quizIdleLine();                        // đang đố: để người xem nghĩ (≥ 6 giây), nhắc câu hỏi / khều trả lời
    if (ql) { if (quiet >= 6000) say(ql, { tag: 'idle' }); return; }
    if (!settings.idleTalk || quiet < effectiveIdleGapSec(settings.idleGapSec, !settings.mcGiftCta) * 1000) return;   // an toàn: nghỉ ≥ 15 giây giữa các câu nói vu vơ (đố / Đại chiến không đổi)
    const il = idleLine();
    if (il) say(il, { tag: 'idle' });
  }, 300);
}

/* ---------- tải sẵn giọng câu cố định ---------- */
// mọi câu không chứa tên người / số liệu thay đổi — xếp câu hay dùng nhất lên đầu để tạo trước
export function staticLines(){
  const pts = [...new Set([...tiers().map(([, p]) => p), settings.fullPts])];
  const out = [
    // cảm ơn quà (đoạn ghép quanh tên người)
    'và', 'Cảm ơn', 'Woa, cảm ơn', 'Trời ơi,', 'Đại gia', 'chơi lớn quá!', 'Ôi trời ơi!', 'đã thắp sáng cả nước!', 'rất rất nhiều!', 'Cả 34 tỉnh, thành rực sáng cùng lúc!',
    ...GIFT_NAMES.flatMap(g => [`đã tặng ${g}!`, `đã tặng ${g}, cảm ơn bạn nhiều lắm!`, `Cảm ơn bạn đã tặng ${g}!`, `ơi, cảm ơn bạn đã tặng ${g}!`]),
    ...GREET_TAIL, ...GREET_MANY, ...CALLOUT, 'vượt qua', ...duelStaticLines(), ...quizStaticLines(),
  ];
  const safe = !settings.mcGiftCta;   // an toàn: không tải sẵn giọng câu kêu gọi tặng quà, thay bằng câu mời tương tác
  for (const ten of NAMES) out.push(`vừa thắp đèn cho ${ten}.`, `thắp thêm đèn cho ${ten}.`, ...pts.map(p => `Cộng ${p} điểm cho ${ten}.`), `vừa trở thành Chủ tỉnh ${ten}!`);
  for (let n = 5; n < NAMES.length; n += 5) out.push(`Bản đồ đã sáng ${n} trên 34 tỉnh, thành rồi. Còn ${NAMES.length - n} tỉnh nữa thôi!`);
  out.push('Tuyệt vời quá! Cả 34 tỉnh, thành đã sáng đèn. Cảm ơn bà con khắp mọi miền đất nước!',
    ...(safe ? allInteractLines() : donateLines()), ...filterIdleLines(INVITE, safe), ISLAND_IDLE, ...Object.values(ISLAND_LINE), 'Bạn có biết?', 'Còn một phút nữa là hết vòng đua.', 'Ai quê ở đó vào thắp đèn đi nào!', 'Các quê khác cố lên nào!', 'Quê bạn đang ở đâu, vào thắp đèn đi nào!',
    ...(safe ? ['Vòng mới bắt đầu rồi, bà con comment tên quê để thắp đèn nhé!'] : ['Vòng mới bắt đầu rồi, tặng quà để quê mình về nhất nhé!', 'Đồng hương ơi, tặng quà kéo quê mình lên nào!', 'Ai sẽ vượt lên đứng đầu bục vinh danh đây?']),
    'Xin chào bà con! Comment tên tỉnh, thành quê mình để thắp một ngọn đèn trên bản đồ Việt Nam nhé.');
  for (const ten of NAMES) out.push(`quê ${ten} đã quay lại, thắp đèn cho ${ten}.`, `quê ${ten} đã quay lại.`, `${ten}.`, `Chúc mừng bà con ${ten}!`, `Về nhì là ${ten}.`, ...INFO[ten].facts);
  return [...new Set(out.map(stripOi))];   // đoạn "ơi, …" đọc thành "tên ơi" + phần sau (joinOi) → tải sẵn phần sau
}
export function pruneCache(){
  try {   // giữ nguyên giọng câu cố định, chỉ dọn giọng tên người cũ nhất khi quá 4000 file
    const o = ttsOpts(), keep = new Set(staticLines().map(t => cacheName(t, o)));
    const fl = fs.readdirSync(CACHE_DIR).filter(f => !keep.has(f)).map(f => ({ f, m: fs.statSync(path.join(CACHE_DIR, f)).mtimeMs })).sort((a, b) => a.m - b.m);
    while (fl.length > 4000) fs.unlinkSync(path.join(CACHE_DIR, fl.shift().f));
  } catch {}
}
let warmRunning = false;
export async function prewarm(){
  if (FAKE_TTS || warmRunning) return; warmRunning = true;
  try {
    const o = ttsOpts(), todo = staticLines().filter(t => !cachedFile(t, o)), total = todo.length;
    if (!total) { addLog(`🎙️ Giọng ${staticLines().length} câu cố định đã tải sẵn`); return 0; }
    addLog(`🎙️ Đang tải sẵn giọng ${total} câu cố định...`);
    let done = 0, fails = 0, idx = 0;
    const worker = async () => { while (idx < todo.length && fails < 8) { const t = todo[idx++]; try { const { buf } = await synthesizeTTS(t, { ...o, noFallback: true, low: true }); writeCache(t, o, buf); done++; fails = 0; } catch { fails++; } } };
    await Promise.all([worker(), worker()]);
    if (fails >= 8) { addLog(`⚠️ Tải sẵn giọng được ${done}/${total} thì Edge lỗi liên tục, thử lại sau 1 phút`); setTimeout(() => { warmRunning = false; prewarm(); }, 60_000).unref(); return total - done; }
    addLog(`🎙️ Đã tải sẵn giọng ${done}/${total} câu cố định`);
    return total - done;
  } finally { warmRunning = false; }
}
