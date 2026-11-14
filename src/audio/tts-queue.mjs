// TẦNG 4 — hàng đợi giọng đọc MC có ưu tiên.
//   say (câu gõ tay) > win > gift = light > light2 > greet = chat > idle
//   Câu ưu tiên thấp bị bỏ khi hàng đợi đầy → không bao giờ đọc trễ hàng chục phút so với thực tế.
import { broadcast, addLog } from '../core/bus.mjs';
import { partsOf, textOf, prepare as realPrepare, withTimeout } from './tts-engine.mjs';

// cho bộ test thay máy tạo giọng thật bằng bản giả (không gọi mạng)
let prepare = realPrepare;
export const _setPrepare = fn => { prepare = fn || realPrepare; };

const ttsQueue = [];
let ttsBusy = false, curPlay = null;
export let lastSpokenUntil = 0;
const GAP_MS = 150;   // nghỉ ngắn sau mỗi câu: bù độ trễ tải file ở màn hình, không bao giờ đè lên câu đang đọc
const PRIORITY = { say: 7, win: 6, gift: 5, light: 5, quiz: 5, light2: 3, greet: 2, chat: 2, idle: 1 };

export const queueLen = () => ttsQueue.length;
export const queueCount = tag => ttsQueue.filter(x => x.meta.tag === tag).length;
export const isBusy = () => ttsBusy || ttsQueue.length > 0;

export function say(text, meta = {}){
  return new Promise(resolve => {
    const parts = partsOf(text);
    if (!parts.length) return resolve();
    const item = { text: textOf(parts).slice(0, 400), parts, meta, resolve };
    const pr = PRIORITY[meta.tag] || 1;
    if (pr === 7) {   // câu gõ tay: chen lên đầu, ngắt câu đang đọc (đọc lại sau)
      ttsQueue.unshift(item);
      if (curPlay && curPlay.item.meta.tag !== 'say') { const it = curPlay.item; it.interrupted = true; ttsQueue.splice(1, 0, it); broadcast({ t: 'ttsStop' }); curPlay.cancel(); }
    } else {
      if (pr >= 5) for (let i = ttsQueue.length - 1; i >= 0; i--) if ((PRIORITY[ttsQueue[i].meta.tag] || 1) < 3) { ttsQueue[i].resolve(); ttsQueue.splice(i, 1); }
      if (pr < 3 && ttsQueue.length >= 1) return resolve();
      if (pr < 5 && ttsQueue.length >= 4) return resolve();
      if (ttsQueue.length >= 10) { const k = ttsQueue.findIndex(x => (PRIORITY[x.meta.tag] || 1) < 6); if (k >= 0) { ttsQueue[k].resolve(); ttsQueue.splice(k, 1); } }
      let k = ttsQueue.findIndex(x => (PRIORITY[x.meta.tag] || 1) < pr); if (k < 0) k = ttsQueue.length;
      ttsQueue.splice(k, 0, item);
    }
    prepare(parts);
    pumpTTS();
  });
}

async function pumpTTS(){
  if (ttsBusy || !ttsQueue.length) return; ttsBusy = true;
  const item = ttsQueue.shift(), { text, meta } = item;
  let dur;
  try {
    const { url, bytes, sec } = await withTimeout(prepare(item.parts), 18_000, 'TTS quá 18 giây');
    dur = Math.max(1, Math.round((sec || bytes / 6000) * 10) / 10);   // độ dài thật của MP3 (xem mp3Seconds)
    broadcast({ t: 'tts', url, text, durationSec: dur, tag: meta.tag });
  } catch (e) {
    addLog(`🎙️ Máy chủ giọng Edge (Microsoft) đang chập chờn — câu này chỉ hiện chữ, không đọc: "${text.slice(0, 60)}" (${e?.message || e})`);
    dur = Math.max(2, Math.round(text.length / 14));
    broadcast({ t: 'tts', url: '', text, durationSec: dur, tag: meta.tag });
  }
  lastSpokenUntil = Date.now() + dur * 1000;
  await new Promise(r => { const t = setTimeout(r, Math.max(800, dur * 1000 + GAP_MS)); curPlay = { item, cancel: () => { clearTimeout(t); r(); } }; });
  curPlay = null;
  lastSpokenUntil = Date.now(); ttsBusy = false;
  if (item.interrupted) item.interrupted = false; else item.resolve?.();
  setTimeout(pumpTTS, 30);
}
