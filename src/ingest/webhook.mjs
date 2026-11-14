// TẦNG 1 — adapter webhook: nhận sự kiện từ công cụ ngoài (TikFinity, Streamer.bot, script) qua POST /rpc "event.*".
// Dùng khi không kết nối TikTok trực tiếp. Mã người xem có tiền tố ext_ để không trùng với người xem TikTok.
import { sanitizeText } from './sanitize.mjs';
import { onChat, onLike, onGift, onJoin } from '../domain/game.mjs';
import { clamp } from '../core/bus.mjs';
import { findGift } from './gift-catalog.mjs';

const user = p => {
  const name = sanitizeText(p.name || p.nickname || p.uniqueId || 'bạn', 40) || 'bạn';
  const id = String(p.userId || p.uniqueId || name).replace(/[^\w.-]/g, '').slice(0, 60) || 'anon';
  const avatar = /^https:\/\//.test(String(p.avatar || '')) ? String(p.avatar).slice(0, 500) : '';
  return { uid: 'ext_' + id, name, avatar };
};
export const webhookEvents = {
  chat(p){ const u = user(p); onChat(u.uid, u.name, String(p.text || p.comment || ''), u.avatar); },
  like(p){ const u = user(p); onLike(u.uid, u.name, clamp(p.count || p.likeCount || 1, 1, 999), u.avatar); },
  gift(p){
    const u = user(p), gid = String(p.giftId ?? '').replace(/\D/g, '').slice(0, 20), g = findGift(gid, p.gift || p.giftName);
    onGift(u.uid, u.name, g?.name || sanitizeText(p.gift || p.giftName || 'Quà', 40), clamp(p.count || p.repeatCount || 1, 1, 9999), clamp(p.coins || p.diamondCount || g?.coins || 1, 1, 100000), u.avatar, g?.id || gid);
  },
  join(p){ const u = user(p); onJoin(u.uid, u.name, u.avatar); },
};
