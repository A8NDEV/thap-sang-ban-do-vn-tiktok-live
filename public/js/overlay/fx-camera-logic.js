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
