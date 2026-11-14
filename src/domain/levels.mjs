// Cấp độ người tặng theo tổng xu cộng dồn cả buổi. Thuần: không DOM, không Node API.
export const LEVEL_NAMES = ['', 'Đồng', 'Bạc', 'Vàng', 'Kim cương'];
export const DEFAULT_TIERS = [10, 100, 500, 2000];

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function validTiers(t) {
  if (!Array.isArray(t) || t.length !== 4) return false;
  for (let i = 0; i < 4; i++) {
    if (!isNum(t[i]) || t[i] <= 0) return false;
    if (i > 0 && t[i] <= t[i - 1]) return false;
  }
  return true;
}

// '10,100,500,2000' -> [10,100,500,2000]; sai định dạng/thiếu/không tăng -> bản sao DEFAULT_TIERS.
export function parseTiers(str) {
  if (typeof str === 'string') {
    const parts = str.split(',').map((s) => s.trim());
    if (parts.length === 4 && parts.every((s) => s !== '')) {
      const nums = parts.map(Number);
      if (validTiers(nums)) return nums;
    }
  }
  return DEFAULT_TIERS.slice();
}

// tiers sai dạng -> dùng DEFAULT_TIERS (không ném lỗi).
export function levelOf(coins, tiers) {
  if (!isNum(coins) || coins <= 0) return 0;
  const t = validTiers(tiers) ? tiers : DEFAULT_TIERS;
  let lv = 0;
  for (let i = 0; i < 4; i++) if (coins >= t[i]) lv = i + 1;
  return lv;
}

export function nextInfo(coins, tiers) {
  const t = validTiers(tiers) ? tiers : DEFAULT_TIERS;
  const level = levelOf(coins, t);
  if (level >= 4) return { level, name: LEVEL_NAMES[level], next: null, need: 0 };
  const have = isNum(coins) && coins > 0 ? coins : 0;
  return { level, name: LEVEL_NAMES[level], next: LEVEL_NAMES[level + 1], need: t[level] - have };
}
