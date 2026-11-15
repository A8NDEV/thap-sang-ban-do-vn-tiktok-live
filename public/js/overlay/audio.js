// Kênh âm thanh phía màn hình: giọng MC (file từ máy chủ) + nhạc nền lặp, âm lượng cố định (mặc định 50%), KHÔNG hạ nhỏ khi MC nói.
//
// Kinh nghiệm từ Quán Nhậu Chung (LIVE bằng điện thoại):
//   - iPhone / iPad (mọi trình duyệt đều là WebKit) chỉ cho phát tiếng trên thẻ <audio> ĐÃ TỪNG được phát trong một lần
//     chạm (touchend / click — không phải pointerdown, không phải trong .then() sau đó). Tạo new Audio() cho mỗi câu
//     → từ câu thứ 2 bị chặn im lặng. → Dùng LẠI MỘT thẻ giọng + một thẻ nhạc, "mồi" cả hai ngay trong lần chạm.
//   - Nút gạt im lặng của iPhone tắt tiếng trang web → xin phiên âm thanh "playback" + phát lặp 1 đoạn im lặng.
//   - Điện thoại (màn cảm ứng) luôn phải chạm 1 lần → hiện nút to "Chạm để bật tiếng" ngay từ đầu, không đợi lỗi.
import { $ } from './util.js';

// ?mute=1 → không phát tiếng (xem trước / kiểm tra khi đang LIVE bằng máy khác)
export const MUTE = new URLSearchParams(location.search).has('mute');
const TOUCH = matchMedia('(pointer: coarse)').matches;
let unlocked = false, talking = false, talkT = null, cur = null;
const voice = new Audio(); voice.preload = 'auto';
const bgm = new Audio(); bgm.preload = 'auto';
let music = { files: [], on: true, vol: 50 }, playlist = [];
const hint = on => { const h = $('#soundHint'); if (h) h.style.display = on && !MUTE ? 'flex' : 'none'; };

// 0,5 giây im lặng (WAV 8 kHz) để mồi thẻ âm thanh trong lần chạm
const SILENT = (() => {
  const n = 4000, b = new DataView(new ArrayBuffer(44 + n)), w = (o, s) => [...s].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); b.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true);
  b.setUint32(24, 8000, true); b.setUint32(28, 8000, true); b.setUint16(32, 1, true); b.setUint16(34, 8, true); w(36, 'data'); b.setUint32(40, n, true);
  for (let i = 0; i < n; i++) b.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([b.buffer], { type: 'audio/wav' }));
})();

// Chỉ đọc trạng thái (hiệu ứng đập theo nhạc dùng): MC đang nói / nhạc nền đang phát. Không đụng tới luồng âm thanh.
export function audioState(){ return { talking: !!talking, music: !!(music.on && !bgm.paused && !bgm.ended && bgm.readyState > 0) }; }
function setTalk(on){ talking = on; $('#mcTag').classList.toggle('talk', on); bgmVol(); }
function bgmVol(){ bgm.volume = Math.max(0, Math.min(1, music.vol / 100)); }   // giữ nguyên âm lượng, không hạ khi MC nói
function nextSong(){
  if (MUTE || !music.on || !music.files.length) { bgm.pause(); return; }
  if (!playlist.length) playlist = [...music.files].sort(() => Math.random() - .5);
  bgm.src = playlist.pop(); bgmVol();
  bgm.play().catch(() => { if (!unlocked) hint(true); });
}
bgm.onended = nextSong; bgm.onerror = () => { if (bgm.src !== SILENT) setTimeout(nextSong, 1000); };

export function setMusic(m){
  const changed = m.files.join('|') !== music.files.join('|');
  music = m; bgmVol();
  if (!m.on || !m.files.length) { bgm.pause(); return; }
  if (changed) playlist = [];
  if (changed && bgm.src && !m.files.some(f => bgm.src.endsWith(f))) nextSong();
  else if (bgm.paused) nextSong();
}

// Câu mới tới khi câu cũ chưa đọc xong (mạng chậm / máy chủ tính lệch) → xếp hàng chờ, KHÔNG cắt ngang.
// Chỉ lệnh ttsStop (MC gõ tay chen ngang) mới được dừng câu đang đọc.
const waitQ = [];
const playing = () => cur && !voice.paused && !voice.ended;
export function playVoice(m){
  if (!MUTE && m.url && playing()) { if (waitQ.length >= 3) waitQ.shift(); waitQ.push(m); return; }
  startVoice(m);
}
function done(){ cur = null; clearTimeout(talkT); const n = waitQ.shift(); if (n) startVoice(n); else setTalk(false); }
voice.onended = () => { if (cur) done(); };
voice.onerror = () => { if (cur) done(); };
function startVoice(m){
  cur = null;
  setTalk(true); clearTimeout(talkT); talkT = setTimeout(() => setTalk(false), (m.durationSec || 3) * 1000 + 500);
  if (!m.url || MUTE) return;
  cur = m;
  voice.src = m.url;      // dùng lại cùng một thẻ (iPhone chỉ cho phát thẻ đã được mồi trong lần chạm)
  voice.play().then(() => { unlocked = true; hint(false); }).catch(() => { if (!unlocked) { hint(true); cur = null; } });
}
export function stopVoice(){ waitQ.length = 0; cur = null; voice.pause(); setTalk(false); }

// Mở tiếng trong lần chạm / bấm / gõ phím. Gọi play() NGAY trong sự kiện (không qua await) thì iPhone mới nhận.
let keep = null;
let actx = null;
function getAudioCtx(){
  if (MUTE) return null;
  if (!actx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) actx = new Ctx();
  }
  if (actx && actx.state === 'suspended') {
    actx.resume().catch(() => {});
  }
  return actx;
}

export function playSfx(type = 'chime', arg = 0){
  if (MUTE) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    if (type === 'light') {
      [1567.98, 2093.00].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.05);
        gain.gain.setValueAtTime(0.12, now + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.05 + 0.38);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.05);
        osc.stop(now + i * 0.05 + 0.4);
      });
    } else if (type === 'chime') {
      [1318.51, 1567.98, 1975.53, 2637.02].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.07);
        gain.gain.setValueAtTime(0.18, now + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.07 + 0.65);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.07);
        osc.stop(now + i * 0.07 + 0.7);
      });
    } else if (type === 'boom') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.36);
      gain.gain.setValueAtTime(0.42, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.52);

      const bufSize = Math.floor(ctx.sampleRate * 0.32);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.25));
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(110, now + 0.32);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.28, now);
      nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);
      noise.start(now);
    } else if (type === 'fanfare') {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        gain.gain.setValueAtTime(0.26, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 1.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 1.25);
      });
      for (let k = 0; k < 5; k++) {
        setTimeout(() => {
          if (actx && actx.state === 'running') playSfx('firework');
        }, 150 + k * 180);
      }
    } else if (type === 'combo') {
      const step = (arg || 3) % 15;
      const freq = 440 * Math.pow(2, step / 12);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);

      if (arg && arg % 5 === 0) {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 1.5, now + 0.05);
        gain2.gain.setValueAtTime(0.15, now + 0.05);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.05);
        osc2.stop(now + 0.32);
      }
    } else if (type === 'alert') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.16);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);

      const sec = typeof arg === 'number' ? arg : 10;
      const sirenFreq = 700 + (10 - Math.max(1, sec)) * 60;
      const sOsc = ctx.createOscillator();
      const sGain = ctx.createGain();
      sOsc.type = 'triangle';
      sOsc.frequency.setValueAtTime(sirenFreq, now);
      sGain.gain.setValueAtTime(0.18, now);
      sGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
      sOsc.connect(sGain);
      sGain.connect(ctx.destination);
      sOsc.start(now);
      sOsc.stop(now + 0.16);
    } else if (type === 'clash') {
      [2400, 3200].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.02);
        gain.gain.setValueAtTime(0.12, now + i * 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.02 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.02);
        osc.stop(now + i * 0.02 + 0.28);
      });
    } else if (type === 'thunder') {
      const bufSize = Math.floor(ctx.sampleRate * 0.45);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.3));
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3200, now);
      filter.frequency.exponentialRampToValueAtTime(140, now + 0.45);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.45, now);
      nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);
      noise.start(now);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(28, now + 1.2);
      gain.gain.setValueAtTime(0.55, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.35);

      setTimeout(() => {
        if (ctx && ctx.state === 'running') playSfx('fanfare');
      }, 400);
    } else if (type === 'firework') {
      const bufSize = Math.floor(ctx.sampleRate * 0.2);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.15));
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1800;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(now);
    }
  } catch (err) {
    console.warn('SFX error:', err);
  }
}

function unlock(){
  if (MUTE) return;
  try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch {}
  if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
  else getAudioCtx();
  if (TOUCH && !keep) { keep = new Audio(SILENT); keep.loop = true; keep.play().catch(() => { keep = null; }); }   // vượt nút gạt im lặng
  if (voice.paused) {
    if (cur) voice.play().then(() => { unlocked = true; hint(false); }).catch(() => {});
    else { voice.src = SILENT; voice.play().then(() => { unlocked = true; hint(false); const n = waitQ.shift(); if (n) startVoice(n); }).catch(() => {}); }
  }
  if (bgm.paused) {
    if (music.on && music.files.length) nextSong();
    else { bgm.src = SILENT; bgm.play().catch(() => {}); }
  }
}
for (const ev of ['touchend', 'click', 'keydown']) addEventListener(ev, unlock, { passive: true });
if (TOUCH) hint(true);   // điện thoại: luôn cần 1 lần chạm → hiện nút ngay từ đầu
