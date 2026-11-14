// Bộ điều khiển chất lượng hiệu ứng: thuần logic, không phụ thuộc DOM/Node.
// Cấp 0 = cao, 1 = vừa, 2 = thấp. Dựa trên trung bình dt (ms) theo cửa sổ thời gian tích lũy.

export const PARTICLE_CAPS = [900, 500, 250];

const DEGRADE_WINDOW_MS = 2000;
const DEGRADE_ABOVE_MS = 24;
const RECOVER_WINDOW_MS = 10000;
const RECOVER_BELOW_MS = 18;
const MAX_DT_MS = 500;

// Hệ số thời gian so với khung 60fps (16.667ms), kẹp [0.25, 3]; giá trị không hợp lệ -> 1.
export function frameScale(dtMs) {
  if (!Number.isFinite(dtMs) || dtMs <= 0) return 1;
  return Math.min(3, Math.max(0.25, dtMs / (1000 / 60)));
}

// Vòng hạt coi là "đang cấp khung" nếu lần cấp gần nhất cách hiện tại dưới windowMs.
export const FEED_ACTIVE_MS = 100;
export function isFeedActive(nowMs, lastFeedAtMs, windowMs = FEED_ACTIVE_MS) {
  if (!Number.isFinite(nowMs) || !Number.isFinite(lastFeedAtMs) || !Number.isFinite(windowMs)) return false;
  if (!(lastFeedAtMs > 0) || nowMs < lastFeedAtMs) return false;
  return nowMs - lastFeedAtMs < windowMs;
}

export function createQuality() {
  let lvl = 0;
  let down = { sum: 0, n: 0 };
  let up = { sum: 0, n: 0 };

  function clear() {
    down = { sum: 0, n: 0 };
    up = { sum: 0, n: 0 };
  }

  function feed(dtMs) {
    if (!(dtMs > 0) || dtMs > MAX_DT_MS) return lvl;

    down.sum += dtMs;
    down.n++;
    up.sum += dtMs;
    up.n++;

    if (down.sum >= DEGRADE_WINDOW_MS) {
      const avg = down.sum / down.n;
      down = { sum: 0, n: 0 };
      if (avg > DEGRADE_ABOVE_MS && lvl < PARTICLE_CAPS.length - 1) {
        lvl++;
        clear();
        return lvl;
      }
    }
    if (up.sum >= RECOVER_WINDOW_MS) {
      const avg = up.sum / up.n;
      up = { sum: 0, n: 0 };
      if (avg < RECOVER_BELOW_MS && lvl > 0) {
        lvl--;
        clear();
      }
    }
    return lvl;
  }

  return {
    feed,
    level: () => lvl,
    cap: () => PARTICLE_CAPS[lvl],
    reset() {
      lvl = 0;
      clear();
    },
  };
}
