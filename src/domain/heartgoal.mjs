// Mục tiêu tim cả phòng: logic thuần (không DOM, không Node API, không tác dụng phụ).
// Mốc là mọi bội số dương của `step`. Nơi gọi giữ tổng tim; module này chỉ tính.

const DEFAULT_STEP = 1000;

const num = (x) => typeof x === 'number' && Number.isFinite(x);

// Số mốc bị vượt khi tổng đi từ prevTotal lên newTotal (0 nếu đầu vào hỏng hoặc không tăng).
export function milestonesCrossed(prevTotal, newTotal, step) {
  if (!num(prevTotal) || !num(newTotal) || !num(step)) return 0;
  if (step <= 0 || prevTotal < 0 || newTotal <= prevTotal) return 0;
  return Math.floor(newTotal / step) - Math.floor(prevTotal / step);
}

// Mốc cao nhất vừa đạt (một giá trị duy nhất dù vượt nhiều mốc), hoặc null.
export function topMilestone(prevTotal, newTotal, step) {
  if (milestonesCrossed(prevTotal, newTotal, step) < 1) return null;
  return Math.floor(newTotal / step) * step;
}

// Dữ liệu vẽ thanh tiến độ. step hỏng -> 1000; total hỏng/âm -> 0.
export function heartView(total, step) {
  const s = num(step) && step > 0 ? step : DEFAULT_STEP;
  const t = num(total) && total > 0 ? total : 0;
  const k = Math.floor(t / s);
  const prev = k * s;
  const next = (k + 1) * s;
  const pct = Math.max(0, Math.min(100, Math.round(((t - prev) / s) * 100)));
  return { total: t, step: s, next, prev, pct };
}
