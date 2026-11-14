// Luật "Cả nước rực sáng": bật khi tổng xu cộng dồn của người tặng VƯỢT QUA một mốc fullCoins
// (hoặc một quà đơn lẻ đủ mốc). Không bật lại ở các quà sau chừng nào chưa vượt mốc kế tiếp.
// totalAfter: tổng cộng dồn SAU khi đã cộng quà này (undefined nếu không theo dõi, ví dụ người xem ảo).
export function crossedFull(totalAfter, coins, fullCoins) {
  const fc = Number(fullCoins);
  const c = Number(coins);
  if (!(fc > 0) || !(c > 0)) return false;
  const total = Number.isFinite(totalAfter) ? totalAfter : c;
  return Math.floor(total / fc) > Math.floor((total - c) / fc);
}
