// TẦNG 1 — adapter TikTok LIVE (tiktok-live-connector): nhận CHAT / GIFT / LIKE / MEMBER, gộp combo quà, tự kết nối lại.
// Chỉ chuyển sự kiện đã chuẩn hóa sang tầng 3 qua các hàm onChat/onGift/onLike/onJoin — không chứa luật chơi.
import { broadcast, addLog } from '../core/bus.mjs';
import { settings } from '../domain/settings.mjs';
import { save } from '../domain/store.mjs';
import { onChat, onGift, onLike, onJoin, onFollow } from '../domain/game.mjs';
import { markRealActivity } from './auto-pacing.mjs';
import { uidOf, nameOf, avatarOf } from './sanitize.mjs';
import { giftInfo, giftName, giftPrice } from './gift-prices.mjs';
import { license, LICENSE_MSG } from '../dist/license.mjs';
import { getSignKey, applySignKey, isBadKeyError, isRateLimit } from './sign-key.mjs';

let TikTokLib = null, conn = null, reconnectTimer = null, shouldAutoReconnect = false;
export let tiktokState = { status: 'idle', uniqueId: '', error: '' };
export const tiktokMsg = () => ({ t: 'tiktok', ...tiktokState });
const pushTikTok = () => broadcast(tiktokMsg());
const cleanId = s => String(s || '').trim().replace(/^.*tiktok\.com\/@?/i, '').replace(/^@/, '').replace(/[/?#].*$/, '').replace(/[^\w.]/g, '').slice(0, 40);

export async function connectTikTok(uniqueId){
  uniqueId = cleanId(uniqueId);
  if (!uniqueId) return false;
  if (!license.ok) { tiktokState = { status: 'error', uniqueId, error: '🔒 ' + LICENSE_MSG }; pushTikTok(); addLog('🔒 ' + LICENSE_MSG); return false; }
  shouldAutoReconnect = true;
  await disconnectTikTok(false);
  tiktokState = { status: 'connecting', uniqueId, error: '' }; pushTikTok();
  try {
    TikTokLib ||= await import('tiktok-live-connector');
    const { TikTokLiveConnection, WebcastEvent, ControlEvent, SignConfig } = TikTokLib;
    const signKey = getSignKey();
    applySignKey(SignConfig, signKey);   // key EulerStream (nếu có): hết giới hạn số lần kết nối mỗi giờ
    const c = new TikTokLiveConnection(uniqueId, { enableExtendedGiftInfo: false, processInitialData: false, ...(signKey ? { signApiKey: signKey } : {}) });
    c.on(WebcastEvent.CHAT, d => { markRealActivity(); const text = d.comment || d.content || d.text || ''; addLog(`💬 ${nameOf(d)}: ${text}`); onChat(uidOf(d), nameOf(d), text, avatarOf(d)); });
    // combo quà: TikTok gửi nhiều thông báo (đang tặng … tặng xong) → chỉ tính 1 lần khi "tặng xong"; không thấy sau 8 giây thì tự chốt
    const pendingGifts = new Map();
    const finishGift = (d, cnt) => { markRealActivity(); const name = giftName(d); onGift(uidOf(d), nameOf(d), name, cnt, giftPrice(d, name), avatarOf(d), String(d.giftId || '')); };
    c.on(WebcastEvent.GIFT, d => {
      markRealActivity();
      const isEnd = d.repeatEnd === 1 || d.repeatEnd === true || d.repeat_end === 1 || d.repeat_end === true;
      const cnt = Math.max(1, +d.repeatCount || +d.comboCount || 1), key = uidOf(d) + '|' + d.giftId;
      let pg = pendingGifts.get(key);
      if (!isEnd) {
        if (!pg) { pg = { d, cnt }; pendingGifts.set(key, pg); }
        pg.d = d; pg.cnt = Math.max(pg.cnt, cnt); clearTimeout(pg.t);
        pg.t = setTimeout(() => { pendingGifts.delete(key); finishGift(pg.d, pg.cnt); }, 8000);
        return;
      }
      if (pg) { clearTimeout(pg.t); pendingGifts.delete(key); }
      finishGift(d, Math.max(cnt, pg?.cnt || 0));
    });
    c.on(WebcastEvent.MEMBER, d => onJoin(uidOf(d), nameOf(d), avatarOf(d)));
    c.on(WebcastEvent.LIKE, d => { markRealActivity(); onLike(uidOf(d), nameOf(d), d.likeCount || 1, avatarOf(d)); });
    c.on(WebcastEvent.FOLLOW, d => { markRealActivity(); onFollow(uidOf(d), nameOf(d), avatarOf(d)); });
    c.on(WebcastEvent.SOCIAL, d => {
      const displayType = String(d.displayType || d.type || d.action || '');
      if (/follow/i.test(displayType)) { markRealActivity(); onFollow(uidOf(d), nameOf(d), avatarOf(d)); }
    });
    c.on(ControlEvent.DISCONNECTED, () => {
      if (conn !== c) return;
      tiktokState = { ...tiktokState, status: 'disconnected' }; pushTikTok();
      addLog(`⚠️ Mất kết nối @${uniqueId}, thử lại sau 8 giây...`);
      if (shouldAutoReconnect) { clearTimeout(reconnectTimer); reconnectTimer = setTimeout(() => { if (shouldAutoReconnect && tiktokState.status === 'disconnected') connectTikTok(uniqueId); }, 8000); }
    });
    c.on(ControlEvent.ERROR, e => addLog('TikTok lỗi: ' + (e?.info || e?.message || e)));
    await c.connect();
    conn = c;
    for (const g of c.availableGifts || []) giftInfo.set(+g.id, { name: g.name, cost: +g.diamond_count || 0 });
    if (!giftInfo.size) c.fetchAvailableGifts().then(list => { for (const g of list || []) giftInfo.set(+g.id, { name: g.name, cost: +g.diamond_count || 0 }); addLog(`🎁 Đã tải bảng giá ${giftInfo.size} loại quà`); }).catch(() => {});
    tiktokState = { status: 'connected', uniqueId, error: '' };
    addLog(`✅ Đã kết nối live @${uniqueId}`);
    if (settings.lastUniqueId !== uniqueId) { settings.lastUniqueId = uniqueId; save(); }
  } catch (e) {
    let err = String(e?.message || e);
    if (isBadKeyError(err)) err = `EulerStream từ chối API key (…${getSignKey().slice(-4)}): key sai hoặc đã bị thu hồi. Sao chép lại key trên eulerstream.com, bấm Lưu key rồi Kết nối lại.`;
    else if (isRateLimit(err) && !getSignKey()) err += ' — Đã hết lượt kết nối miễn phí trong giờ này. Nhập API key EulerStream (miễn phí) ở tab Hướng dẫn kết nối để hết giới hạn.';
    tiktokState = { status: 'error', uniqueId, error: err };
    addLog(`❌ Không kết nối được @${uniqueId}: ${tiktokState.error}`);
    // key sai: thử lại cũng vậy → đợi sửa key. Bị giới hạn: đợi 5 phút. Lỗi khác: 12 giây
    const wait = isBadKeyError(err) ? 0 : isRateLimit(err) ? 300_000 : 12_000;
    if (shouldAutoReconnect && wait) { clearTimeout(reconnectTimer); reconnectTimer = setTimeout(() => { if (shouldAutoReconnect && tiktokState.status !== 'connected') connectTikTok(uniqueId); }, wait); }
  }
  pushTikTok();
  return tiktokState.status === 'connected';
}

export async function disconnectTikTok(userInitiated = true){
  if (userInitiated) { shouldAutoReconnect = false; clearTimeout(reconnectTimer); if (settings.lastUniqueId) { settings.lastUniqueId = ''; save(); } }
  const c = conn; conn = null;
  if (c) { try { await c.disconnect(); } catch {} }
  tiktokState = { status: 'idle', uniqueId: '', error: '' }; pushTikTok();
}
export const isTikTokConnected = () => tiktokState.status === 'connected';
