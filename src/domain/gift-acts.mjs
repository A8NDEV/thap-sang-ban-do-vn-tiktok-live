// TẦNG 3 — QUÀ → HÀNH ĐỘNG (giống bảng gán quà của Sàn Quẩy): chủ kênh bấm chọn quà bằng hình cho từng hành động.
//   - Điểm cho quê LUÔN tính theo bậc xu (giftTiers); hành động chỉ quyết định hiệu ứng / sự kiện đặc biệt.
//   - Quà không gán hành động nào → hiệu ứng theo mức xu như cũ (tim / pháo hoa / rồng vàng).
//   - only: chỉ chạy khi đúng quà đã gán (sự kiện lớn, không tự bốc theo mức xu).
import { findGift, byId } from '../ingest/gift-catalog.mjs';

export const GIFT_ACTS = [
  { id: 'hoahong', label: 'Mưa hoa hồng', emoji: '🌹', gift: 'Rose' },
  { id: 'tim', label: 'Tim bay khắp quê', emoji: '💛', gift: 'Finger Heart' },
  { id: 'camera', label: 'Camera bay quanh quê', emoji: '🎥', gift: 'TikTok' },
  { id: 'phaohoa', label: 'Pháo hoa cả bản đồ', emoji: '🎆', gift: 'Doughnut' },
  { id: 'daichien', label: 'Mở Đại chiến ngay', emoji: '⚔️', gift: 'Perfume', only: true },
  { id: 'rong', label: 'Sao băng vàng', emoji: '🌠', gift: 'Confetti' },
  { id: 'casang', label: 'Cả nước rực sáng', emoji: '🎉', gift: '', only: true },
];
export const ACT_IDS = GIFT_ACTS.map(a => a.id);

// quà mặc định: tra tên Anh trong danh sách quà → mã quà
export function defaultGiftMap(){
  const m = {};
  for (const a of GIFT_ACTS) m[a.id] = a.gift ? (findGift('', a.gift)?.id || '') : '';
  return m;
}
// làm sạch bảng gán: { hanhDong: 'mã1,mã2' } — chỉ mã số, tối đa 5 quà mỗi hành động, 1 quà chỉ thuộc 1 hành động
export function cleanGiftMap(o){
  const out = {}, used = new Set();
  for (const id of ACT_IDS) {
    const ids = String(o?.[id] ?? '').split(',').map(s => s.trim()).filter(s => /^\d{1,20}$/.test(s) && !used.has(s)).slice(0, 5);
    ids.forEach(s => used.add(s)); out[id] = ids.join(',');
  }
  return out;
}
// hành động của một lượt tặng (mã quà ưu tiên, không có mã thì so tên)
export function actFor(map, giftId, giftName){
  const g = findGift(giftId, giftName); const id = g?.id || String(giftId || '');
  if (!id) return '';
  for (const a of GIFT_ACTS) if (String(map?.[a.id] || '').split(',').includes(id)) return a.id;
  return '';
}
// thực đơn quà hiện trên màn hình LIVE: hình quà + hành động (kích thích tặng đúng quà)
export function giftMenu(map){
  return GIFT_ACTS.map(a => {
    const g = byId.get(String(map?.[a.id] || '').split(',')[0]);
    return g ? { act: a.id, emoji: a.emoji, label: a.label, gift: g.name, coins: g.coins, img: g.img } : null;
  }).filter(Boolean);
}
