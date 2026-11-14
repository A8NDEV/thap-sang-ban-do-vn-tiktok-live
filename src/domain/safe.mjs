// Chế độ an toàn TikTok: logic thuần (không DOM, không Node API) để tránh bị phạt "chèo kéo quà tặng".
// Dùng chung cho mc.mjs (câu MC nói lúc vắng), game.mjs và auto-pacing.mjs.

const MIN_SAFE_GAP_SEC = 15;
const CTA_GAP_MS = 4 * 60_000;
const NO_REPEAT_MS = 30 * 60_000;

const isNum = n => typeof n === 'number' && Number.isFinite(n);

// Khoảng nghỉ giữa các câu MC nói lúc vắng: an toàn → tối thiểu 15 giây; thường → đúng như cài đặt (sai → 1 giây).
export function effectiveIdleGapSec(idleGapSec, safe){
  if (safe) return isNum(idleGapSec) ? Math.max(MIN_SAFE_GAP_SEC, idleGapSec) : MIN_SAFE_GAP_SEC;
  return isNum(idleGapSec) ? idleGapSec : 1;
}

// Câu mời follow / thả tim: an toàn → tối đa 1 lần mỗi minGapMs. lastAtMs ở tương lai coi là chưa đủ cách.
export function ctaAllowed(lastAtMs, nowMs, safe, minGapMs = CTA_GAP_MS){
  if (!safe) return true;
  if (!lastAtMs) return true;
  return nowMs - lastAtMs >= minGapMs;
}

// Câu mời follow / thả tim (để áp ctaAllowed).
const CTA_RE = /follow|theo dõi|thả tim|bấm tim|nhấn tim/iu;
export const isFollowLikeCta = text => CTA_RE.test(String(text ?? '').normalize('NFC'));

// Câu cảm ơn SAU khi tặng: luôn được giữ ("Cảm ơn Nam đã tặng Hoa hồng!").
const THANKS_RE = /đã tặng/iu;   // "Cảm ơn Nam đã tặng Hoa hồng!", "đã tặng Tim ngón tay!" (đoạn ghép quanh tên người)
// Câu kêu gọi / hứa thưởng khi tặng quà (TikTok coi là "chèo kéo quà tặng").
const SOLICIT_RES = [
  /tặng quà/iu, /tặng một/iu, /tặng đủ/iu, /tặng nhiều/iu,
  /món quà/iu, /nhiều quà/iu, /quà từ/iu, /thêm quà/iu,
  /xu là/iu, /xu thôi/iu,
  /bông hồng/iu, /bánh donut/iu, /tim ngón tay/iu,
  /rực sáng.*tên bạn/iu, /bục vinh danh/iu,
];

export function isGiftSolicitation(text){
  const s = String(text ?? '').normalize('NFC');
  if (!s) return false;
  for (const sentence of s.split(/(?<=[.!?…])\s+/u)) {
    if (THANKS_RE.test(sentence)) continue;
    if (SOLICIT_RES.some(re => re.test(sentence))) return true;
  }
  return false;
}

const textOf = l => (l && typeof l === 'object' ? l.t : l);

// An toàn → bỏ câu chèo kéo quà; thường → giữ nguyên (bản sao).
export function filterIdleLines(lines, safe){
  const arr = Array.isArray(lines) ? lines : [];
  return safe ? arr.filter(l => !isGiftSolicitation(textOf(l))) : [...arr];
}

// Bộ nhớ "câu đã nói": không nhắc lại một câu trong windowMs (mặc định 30 phút). Tự dọn mục quá hạn.
export function createSpokenMemory(windowMs = NO_REPEAT_MS){
  const at = new Map();
  const prune = now => { for (const [k, t] of at) if (!(now - t < windowMs)) at.delete(k); };
  return {
    recent(key, now){ prune(now); return at.has(key); },
    mark(key, now){ prune(now); at.set(key, now); },
    size: () => at.size,
    clear: () => at.clear(),
  };
}
