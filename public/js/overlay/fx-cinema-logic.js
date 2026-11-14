// Logic thuần cho hiệu ứng điện ảnh (B1 đèn lồng, B2 cảnh quà lớn).
// Không import DOM/Node: file này chạy cả trong trình duyệt lẫn node --test.

export const LANTERN_MAX = 24;

export function giftTier(coins) {
  if (typeof coins !== 'number' || !Number.isFinite(coins) || coins <= 0) return 0;
  if (coins >= 1000) return 3;
  if (coins >= 100) return 2;
  if (coins >= 30) return 1;
  return 0;
}

export function createBudget(max) {
  let active = 0;
  return {
    tryAcquire(n = 1) {
      if (!Number.isFinite(n) || n <= 0 || active + n > max) return false;
      active += n;
      return true;
    },
    release(n = 1) {
      if (!Number.isFinite(n) || n <= 0) return;
      active = Math.max(0, active - n);
    },
    get active() { return active; },
  };
}

export function lanternCount(quality, fresh) {
  if (!fresh) return 0;
  if (quality <= 0) return 6;
  if (quality === 1) return 3;
  return 0;
}
