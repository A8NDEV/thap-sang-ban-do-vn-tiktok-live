// TẦNG 2 — mọi lệnh điều khiển đi qua một bảng phương thức JSON-RPC 2.0 duy nhất,
// dùng chung cho POST /rpc (Streamer.bot, curl, script) và WebSocket /ws (bảng điều khiển).
import { broadcast, requestQuit } from '../core/bus.mjs';
import { settings, applySettings } from '../domain/settings.mjs';
import { save } from '../domain/store.mjs';
import { snapshot, pushNow, endRound, resetRound, resetMap, newSession } from '../domain/game.mjs';
import { say } from '../audio/tts-queue.mjs';
import { ttsOpts } from '../audio/tts-engine.mjs';
import { prewarm } from '../audio/mc.mjs';
import { pushMusic, musicMsg, deleteMusic } from '../audio/music.mjs';
import { signView, setSignKey } from '../ingest/sign-key.mjs';
import { setPhoneMode } from './phone-mode.mjs';
import { sanitizeText } from '../ingest/sanitize.mjs';
import { connectTikTok, disconnectTikTok, tiktokState } from '../ingest/tiktok.mjs';
import { setPrice, pricesMsg } from '../ingest/gift-prices.mjs';
import { demo, simulate } from '../ingest/demo.mjs';
import { startDuel, stopDuel } from '../domain/duel.mjs';
import { startQuiz, stopQuiz } from '../domain/quiz.mjs';
import { startChest, stopChest } from '../domain/chest.mjs';
import { startAutoPacing, stopAutoPacing } from '../ingest/auto-pacing.mjs';
import { getRegionsSnapshot, resetRegionsScore, addRegionScore, toggle3MienModal } from '../domain/regions.mjs';
import { ownersView, resetOwners } from '../domain/owners.mjs';
import { webhookEvents } from '../ingest/webhook.mjs';
import { license, LICENSE_MSG, licenseMsg } from '../dist/license.mjs';
import { catalogView, refreshCatalog } from '../ingest/gift-catalog.mjs';
import { GIFT_ACTS } from '../domain/gift-acts.mjs';
import { updater, dataSync, distMsg, pushDist } from '../dist/index.mjs';
import { obsLinks, addHost, openWindow, fixFirewall } from './obs.mjs';

class RpcError extends Error { constructor(code, message){ super(message); this.code = code; } }
const need = (cond, msg) => { if (!cond) throw new RpcError(-32602, msg); };
const needLicense = () => { if (!license.ok) throw new RpcError(-32003, LICENSE_MSG); };

export const METHODS = {
  // đọc
  'state.get': () => snapshot(),
  'settings.get': () => ({ ...settings }),
  'tiktok.status': () => ({ ...tiktokState }),
  'gift.prices': () => pricesMsg(),
  'license.get': () => licenseMsg(),

  // bản quyền (key mua ở vn-tool.online, kích hoạt 1 lần mỗi máy)
  'license.activate': async p => {
    const r = await license.activate(p?.key);
    if (!r.ok) throw new RpcError(-32004, r.message);
    broadcast(licenseMsg(), 'control');
    dataSync.sync().then(pushDist);   // kích hoạt xong → tải ngay gói giọng MC + nhạc mẫu
    return { ...licenseMsg(), devices: r.devices, maxDevices: r.maxDevices };
  },

  // kết nối TikTok
  'tiktok.connect': async p => { needLicense(); need(p?.uniqueId, 'Thiếu uniqueId'); connectTikTok(p.uniqueId); return { ok: true }; },
  'tiktok.disconnect': async () => { await disconnectTikTok(true); return { ok: true }; },

  // cài đặt
  'settings.set': p => {
    need(p && typeof p.settings === 'object', 'Thiếu settings');
    const voiceBefore = JSON.stringify(ttsOpts());
    applySettings(p.settings); save();
    broadcast({ t: 'settings', settings }, 'control'); pushNow();
    if (JSON.stringify(ttsOpts()) !== voiceBefore || 'giftTiers' in p.settings || 'fullCoins' in p.settings) prewarm();
    if ('autoPacing' in p.settings) { if (settings.autoPacing) startAutoPacing(); else stopAutoPacing(); }
    pushMusic();
    return { ...settings };
  },

  // vòng đua / bản đồ
  'round.end': () => { endRound(); return { ok: true }; },
  'round.reset': () => { resetRound(); return { ok: true }; },
  'map.reset': () => { resetMap(); return { ok: true }; },
  'session.new': () => { newSession(); return { ok: true }; },

  // Đại chiến / Chủ tỉnh
  'duel.start': p => { const r = startDuel(p?.a, p?.b); need(r.ok, r.error); return r; },
  'duel.stop': () => { stopDuel(); return { ok: true }; },
  'chest.drop': p => { const r = startChest(p?.prov, p); need(r.ok, r.error); return r; },
  'chest.stop': () => { const r = stopChest(); need(r.ok, r.error); return r; },
  'regions.get': () => getRegionsSnapshot(),
  'regions.reset': () => { resetRegionsScore(); return { ok: true }; },
  'regions.open': () => toggle3MienModal(true),
  'regions.close': () => toggle3MienModal(false),
  'regions.toggle': p => toggle3MienModal(p?.open),
  'regions.bonus': p => { addRegionScore(p?.region, 'bonus', p?.pts || 500, p?.name || 'Thưởng', '', {}); return { ok: true }; },
  'quiz.start': p => { const r = startQuiz(p?.idx); need(r.ok, r.error); return r; },
  'quiz.stop': () => { stopQuiz(); return { ok: true }; },
  'phone.set': async p => { try { return await setPhoneMode(!!p?.on); } catch (e) { throw new RpcError(-32010, e.message); } },
  'sign.get': () => signView(),   // chỉ trả có key hay không + 4 ký tự cuối, không bao giờ trả key
  'sign.set': p => { try { return setSignKey(p?.key); } catch (e) { throw new RpcError(-32602, e.message); } },
  'music.list': () => musicMsg(),
  'music.delete': p => { need(typeof p?.name === 'string' && p.name, 'Thiếu tên bài'); return deleteMusic(p.name); },
  'owners.get': () => ownersView(),
  'owners.reset': () => { resetOwners(); pushNow(); return { ok: true }; },

  // MC
  'mc.say': p => { const t = sanitizeText(p?.text, 400); need(t, 'Thiếu text'); say([{ t, nc: true }], { tag: 'say' }); return { ok: true }; },
  'mc.testVoice': () => { say(['Xin chào bà con! Comment tên tỉnh, thành quê mình để thắp một ngọn đèn trên bản đồ Việt Nam nhé.'], { tag: 'say' }); return { ok: true }; },

  // link OBS / TikTok LIVE Studio / điện thoại (Sàn Quẩy-style)
  'obs.links': () => obsLinks(),
  'obs.addHost': () => addHost(),
  'obs.openWindow': () => openWindow(),
  'obs.fixFirewall': () => fixFirewall(),

  // phiên bản / cập nhật / dữ liệu từ máy chủ (đều cần key)
  'app.status': () => distMsg(),
  'app.quit': () => { setTimeout(requestQuit, 200); return { ok: true }; },   // tắt hẳn app (mở bản mới thì gọi để tắt bản cũ)
  'update.check': async () => { const r = await updater.check(); if (!r.ok) throw new RpcError(-32004, r.error); const { info, ...rest } = r; pushDist(); return rest; },
  'update.apply': () => { updater.apply().catch(() => {}).finally(pushDist); pushDist(); return updater.status(); },
  'data.sync': () => { if (!license.activated) throw new RpcError(-32003, 'Chưa kích hoạt key — nhập key rồi dữ liệu sẽ tự tải.'); dataSync.sync().then(pushDist); pushDist(); return dataSync.status(); },

  // quà: danh sách quà TikTok (hình + giá) và bảng quà → hành động (lưu qua settings.set { giftMap })
  'gift.catalog': () => ({ ...catalogView(), acts: GIFT_ACTS.map(({ id, label, emoji, only }) => ({ id, label, emoji, only: !!only })), map: settings.giftMap }),
  'gift.refresh': async () => { const r = await refreshCatalog(); pushNow(); return r; },

  // giá quà
  'gift.setPrice': p => { need(p?.id, 'Thiếu id'); setPrice(p.id, p.name, p.coins); return pricesMsg(); },

  // thử nghiệm
  'demo.set': p => { demo(!!p?.on); return { on: !!p?.on }; },
  'sim.chat': p => ({ ok: simulate('chat', p) }),
  'sim.like': p => ({ ok: simulate('like', p) }),
  'sim.follow': p => ({ ok: simulate('follow', p) }),
  'sim.gift': p => ({ ok: simulate('gift', p) }),
  'sim.join': p => ({ ok: simulate('join', p) }),

  // webhook từ công cụ ngoài (TikFinity / Streamer.bot)
  'event.chat': p => { needLicense(); webhookEvents.chat(p || {}); return { ok: true }; },
  'event.like': p => { needLicense(); webhookEvents.like(p || {}); return { ok: true }; },
  'event.gift': p => { needLicense(); webhookEvents.gift(p || {}); return { ok: true }; },
  'event.join': p => { needLicense(); webhookEvents.join(p || {}); return { ok: true }; },
};

async function one(req){
  const id = req && 'id' in req ? req.id : undefined;
  const reply = body => id === undefined ? null : { jsonrpc: '2.0', id, ...body };
  if (!req || req.jsonrpc !== '2.0' || typeof req.method !== 'string') return { jsonrpc: '2.0', id: id ?? null, error: { code: -32600, message: 'Invalid Request' } };
  const fn = Object.hasOwn(METHODS, req.method) ? METHODS[req.method] : null;
  if (!fn) return reply({ error: { code: -32601, message: 'Method not found: ' + req.method } });
  try { return reply({ result: (await fn(req.params ?? {})) ?? null }); }
  catch (e) { return reply({ error: { code: e instanceof RpcError ? e.code : -32603, message: String(e?.message || e) } }); }
}
// hỗ trợ cả gói nhiều lệnh (batch)
export async function handleRpc(msg){
  if (Array.isArray(msg)) {
    if (!msg.length || msg.length > 50) return { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } };
    const out = (await Promise.all(msg.map(one))).filter(Boolean);
    return out.length ? out : null;
  }
  return one(msg);
}
export const parseError = () => ({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
