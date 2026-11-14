// TẦNG 1 — bảng giá quà (xu). Ưu tiên: giá người dùng nhập > giá TikTok gửi kèm > danh sách quà TikTok (qua-tiktok.json) > bảng quà kênh > bảng dựng sẵn.
import { broadcast, addLog } from '../core/bus.mjs';
import { FILES, readJSON, writeJSON } from '../core/paths.mjs';
import { findGift } from './gift-catalog.mjs';

export const giftInfo = new Map();     // id → { name, cost } tải từ TikTok khi kết nối
const GIFT_ID_PRICE = { 5655: 1, 5269: 1, 7934: 1, 6064: 1, 5827: 1, 5487: 5, 5658: 20, 5879: 30, 5660: 100, 6267: 299 };
const GIFT_NAME = { 5655: 'Hoa hồng', 5269: 'TikTok', 7934: 'Heart Me', 6064: 'GG', 5827: 'Kem ốc quế', 5487: 'Tim ngón tay', 5658: 'Nước hoa', 5879: 'Bánh donut', 5660: 'Thả tim', 6267: 'Chó Corgi' };
export const GIFT_NAMES = [...new Set(Object.values(GIFT_NAME))];
export let myPrices = readJSON(FILES.prices, {}) || {};
const unknownGifts = new Map();

export const pricesMsg = () => ({ t: 'prices', prices: myPrices, unknown: [...unknownGifts.values()] });
const pushPrices = () => broadcast(pricesMsg(), 'control');

export function setPrice(id, name, coins){
  coins = Math.max(0, Math.round(+coins || 0)); id = String(id || '').trim();
  if (!id) return false;
  if (coins) myPrices['id:' + id] = coins; else delete myPrices['id:' + id];
  if (coins) unknownGifts.delete(id);
  try { writeJSON(FILES.prices, myPrices, true); } catch {}
  addLog(`💰 Giá quà "${name || id}" = ${coins} xu (đã lưu)`); pushPrices();
  return true;
}
export function giftName(d){
  // quà quen có tên tiếng Việt (MC đọc "Hoa hồng" thay vì "Rose")
  return GIFT_NAME[d.giftId] || findGift(d.giftId)?.name || d.giftDetails?.giftName || d.extendedGiftInfo?.name || giftInfo.get(+d.giftId)?.name || d.giftName || `quà mã ${d.giftId}`;
}
export function giftPrice(d, name){
  const c = myPrices['id:' + d.giftId] || +d.giftDetails?.diamondCount || +d.giftDetails?.diamond_count || +d.extendedGiftInfo?.diamond_count
    || findGift(d.giftId, name)?.coins || giftInfo.get(+d.giftId)?.cost || GIFT_ID_PRICE[d.giftId] || 0;
  if (!c) {
    addLog(`⚠️ Không rõ giá quà "${name}" (mã ${d.giftId}), tạm tính 1 xu → nhập giá ở control mục "Giá quà"`);
    const u = unknownGifts.get(String(d.giftId)) || { id: String(d.giftId), name, count: 0 }; u.count++; unknownGifts.set(String(d.giftId), u); pushPrices();
  }
  return c || 1;
}
