// Giới hạn thưởng chia sẻ theo từng người: logic thuần.

// true nếu chưa có lần trước, hoặc đã cách đủ minGapMs (biên dưới gồm cả bằng).
// Đồng hồ lùi (nowMs < lastAtMs) hoặc nowMs hỏng -> false.
export function shareAllowed(lastAtMs, nowMs, minGapMs = 300000) {
  if (typeof nowMs !== 'number' || !Number.isFinite(nowMs)) return false;
  if (typeof lastAtMs !== 'number' || !Number.isFinite(lastAtMs)) return true;
  if (nowMs < lastAtMs) return false;
  return nowMs - lastAtMs >= minGapMs;
}
