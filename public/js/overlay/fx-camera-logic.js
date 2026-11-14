// Logic thuần cho camera "zoom nhẹ mượt". Không import DOM/Node: chạy cả trong trình duyệt lẫn node --test.

export const SOFT_HALF_LIFE_MS = 260;

const isPosNum = (n) => typeof n === 'number' && Number.isFinite(n) && n > 0;

// Làm mượt hàm mũ, độc lập tốc độ khung hình: sau đúng halfLifeMs khoảng cách còn lại giảm một nửa.
export function smoothStep(cur, target, dtMs, halfLifeMs) {
  if (!isPosNum(dtMs)) return cur;
  if (!Number.isFinite(cur) || !Number.isFinite(target)) return Number.isFinite(target) ? target : cur;
  if (!isPosNum(halfLifeMs)) return target;
  return cur + (target - cur) * (1 - 2 ** (-dtMs / halfLifeMs));
}

// Độ phóng nhẹ theo cỡ tỉnh: tỉnh nhỏ phóng nhiều hơn một chút.
export function softScale(size) {
  if (size === 'sm') return 1.3;
  if (size === 'md') return 1.22;
  return 1.15;
}

// Đã đủ gần đích để dừng vòng lặp rAF.
export function isSettled(dx, dy, ds) {
  return Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05 && Math.abs(ds) < 0.0005;
}

// ---- Lò xo giảm chấn tới hạn: bắt đầu êm (vận tốc 0 → tăng dần), không vượt đích, giữ vận tốc khi đổi đích. ----
// Nghiệm đúng (không tích phân gần đúng) nên độc lập tốc độ khung hình và không bị mất ổn định khi dt lớn.
export const SOFT_OMEGA = 4.2;       // rad/s: ~1,3 giây để ổn định; tốc độ tối đa ≈ quãng_đường × ω / e
export const PAN_FRACTION = 0.55;    // zoom nhẹ chỉ dịch tới 55% quãng đường tới tỉnh, không dịch cả bản đồ

export function springStep(x, v, target, dtMs, omega = SOFT_OMEGA) {
  const vel = Number.isFinite(v) ? v : 0;
  if (!Number.isFinite(x)) return { x: Number.isFinite(target) ? target : 0, v: 0 };
  if (!isPosNum(dtMs)) return { x, v: vel };
  if (!Number.isFinite(target)) return { x, v: vel };
  if (!isPosNum(omega)) return { x: target, v: 0 };
  const t = dtMs / 1000;
  const e = Math.exp(-omega * t);
  const d = x - target;
  const b = vel + omega * d;
  return { x: target + (d + b * t) * e, v: (vel - omega * b * t) * e };
}

// Đã đủ gần đích VÀ gần như đứng yên (để dừng vòng lặp rAF).
export function isSpringSettled(dx, dy, ds, vx, vy, vs) {
  return isSettled(dx, dy, ds) && Math.abs(vx) < 0.5 && Math.abs(vy) < 0.5 && Math.abs(vs) < 0.002;
}
