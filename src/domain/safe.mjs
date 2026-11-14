// Chế độ an toàn TikTok: logic thuần (không DOM, không Node API) để tránh bị phạt "chèo kéo quà tặng".
// Dùng cho mc.mjs (lọc câu MC nói lúc vắng + nhớ câu đã nói). Không đổi nhịp nói: chỉ bỏ câu nhắc quà.

const NO_REPEAT_MS = 30 * 60_000;

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
    at(key, now){ prune(now); return at.get(key); },   // thời điểm nói gần nhất (undefined nếu chưa nói / đã quá hạn)
    mark(key, now){ prune(now); at.set(key, now); },
    size: () => at.size,
    clear: () => at.clear(),
  };
}
