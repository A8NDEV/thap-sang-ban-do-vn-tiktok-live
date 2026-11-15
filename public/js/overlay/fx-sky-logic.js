// Logic thuần cho bầu trời đổi theo giờ (không chạm DOM: chạy được cả trong trình duyệt lẫn node --test).
// Khung giờ: 5-7 bình minh, 7-17 ngày, 17-19 hoàng hôn, còn lại đêm.

export function skyPhase(hour) {
  if (typeof hour !== 'number' || !Number.isFinite(hour)) return 'night';
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 17) return 'day';
  if (hour >= 17 && hour < 19) return 'dusk';
  return 'night';
}

// [màu trên, màu dưới]: đều tối vừa đủ để chữ trắng vẫn đọc được (alpha <= .55).
export const SKY_COLORS = Object.freeze({
  dawn: Object.freeze(['rgba(120,70,120,.50)', 'rgba(255,150,110,.34)']),
  day: Object.freeze(['rgba(28,66,140,.52)', 'rgba(40,96,172,.38)']),
  dusk: Object.freeze(['rgba(72,40,112,.52)', 'rgba(232,112,62,.38)']),
  night: Object.freeze(['rgba(4,8,34,.45)', 'rgba(22,20,72,.34)']),
});

const BOUNDS = [5, 7, 17, 19];

// Số mili giây tới ranh giới khung giờ kế tiếp (tối thiểu 1000, tối đa 12 giờ).
export function nextChangeMs(date = new Date()) {
  const t = date instanceof Date ? date : new Date(date);
  const h = t.getHours() + t.getMinutes() / 60 + t.getSeconds() / 3600 + t.getMilliseconds() / 3600000;
  if (!Number.isFinite(h)) return 3600000;
  const next = BOUNDS.find(b => b > h) ?? (BOUNDS[0] + 24);
  return Math.max(1000, Math.round((next - h) * 3600000));
}
