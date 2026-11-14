// TẦNG 4 — tổng hợp giọng đọc: một giọng duy nhất Edge Nam Minh (qua Python edge-tts như Quán Nhậu), không đổi sang giọng khác.
// Câu cố định được tải sẵn vào data/tts_cache; câu có tên người (nc = no-cache) ghép từ nhiều đoạn.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { addLog } from '../core/bus.mjs';
import { TTS_DIR, CACHE_DIR, FILES, readJSON } from '../core/paths.mjs';
import { settings } from '../domain/settings.mjs';

const esc = s => String(s).replace(/[<>&"']/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&apos;' }[c]));
export const partsOf = x => (Array.isArray(x) ? x : [x]).map(p => typeof p === 'string' ? { t: p.trim() } : { t: String(p?.t || '').trim(), nc: !!p?.nc }).filter(p => p.t);
export const textOf = x => partsOf(x).map(p => p.t).join(' ');
export function withTimeout(p, ms, msg){ let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error(msg)), ms); })]).finally(() => clearTimeout(t)); }

/* ---------- Edge, MỘT giọng duy nhất: Nam Minh ----------
   Ưu tiên gói Python edge-tts (như Quán Nhậu Chung): ổn định hơn thư viện Node, tự thử lại trong một tiến trình.
   Máy không có Python + edge-tts → dùng thư viện Node msedge-tts (vẫn giọng Nam Minh).
   KHÔNG có giọng dự phòng khác (đa ngôn ngữ / Google): người dùng chốt 1 giọng. Edge lỗi hẳn → câu đó chỉ hiện chữ, không đọc. */
const SAY_PY = path.join(path.dirname(fileURLToPath(import.meta.url)), 'edge_say.py');
export const VOICE = 'vi-VN-NamMinhNeural';

// tìm Python có gói edge-tts: PYTHON_BIN → data/app-config.json "pythonBin" → C:\Python314 → python → py
let pyBin = null;
const pyReady = (async () => {
  const cands = [process.env.PYTHON_BIN, readJSON(FILES.config, {})?.pythonBin, 'C:\\Python314\\python.exe', 'python', 'py'].filter(Boolean);
  for (const bin of [...new Set(cands)]) {
    const ok = await new Promise(r => execFile(bin, ['-c', 'import edge_tts;print(edge_tts.__version__)'], { windowsHide: true, timeout: 15000 }, (err, out) => r(err ? null : String(out).trim())));
    if (ok) { pyBin = bin; addLog(`🎙️ Giọng Edge qua Python edge-tts ${ok} (${bin})`); return true; }
  }
  addLog('🎙️ Không thấy Python + edge-tts → dùng thư viện Node (kém ổn định hơn). Cài: pip install -U edge-tts');
  return false;
})();

// giới hạn số tiến trình song song, ưu tiên câu đang cần đọc hơn câu tải sẵn
// 3 mức ưu tiên: 0 = câu sắp đọc, 1 = tên người xem mới (tạo sẵn), 2 = câu cố định chạy nền
let edgeActive = 0; const edgeWait = [[], [], []];
async function edgeSlot(prio){ const cap = prio ? 2 : 4; while (edgeActive >= cap) await new Promise(r => edgeWait[prio].push(r)); edgeActive++; }
function edgeFree(){ edgeActive--; const n = edgeWait[0].shift() || edgeWait[1].shift() || edgeWait[2].shift(); if (n) n(); }

let pySeq = 0;
function pyEdge(text, voice, { rate = '+0%', pitch = '+0Hz', volume = '+0%' } = {}, tries = 6){
  const id = `${process.pid}_${Date.now()}_${++pySeq}`, src = path.join(os.tmpdir(), `tsbd_${id}.txt`), dst = path.join(os.tmpdir(), `tsbd_${id}.mp3`);
  fs.writeFileSync(src, text, 'utf8');      // truyền qua file UTF-8: không lỗi dấu tiếng Việt trên Windows
  return new Promise((resolve, reject) => {
    execFile(pyBin, [SAY_PY, voice, rate, pitch, volume, src, dst, String(tries)], { windowsHide: true, timeout: 30000 }, (err, _o, stderr) => {
      let buf = null; try { buf = fs.readFileSync(dst); } catch {}
      for (const f of [src, dst]) { try { fs.unlinkSync(f); } catch {} }
      if (!err && buf && buf.length >= 1024) resolve(buf);
      else reject(new Error(String(stderr || err?.message || 'Edge không trả âm thanh').trim().split('\n').pop()));
    });
  });
}
async function nodeEdge(text, voice, opts){
  const tts = new MsEdgeTTS();
  try {
    return await withTimeout((async () => {
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(esc(text), opts);
      const chunks = [];
      await new Promise((res, rej) => {
        const timer = setTimeout(() => chunks.length ? res() : rej(new Error('Edge TTS timeout')), 6000);
        audioStream.on('data', c => chunks.push(c));
        audioStream.on('close', () => { clearTimeout(timer); res(); });
        audioStream.on('error', err => { clearTimeout(timer); chunks.length ? res() : rej(err); });
      });
      const buf = Buffer.concat(chunks);
      if (buf.length < 1500) throw new Error('Không nhận được âm thanh');
      return buf;
    })(), 7_000, 'Edge TTS treo kết nối');
  } finally { try { tts.close(); } catch {} }
}

// Chỉ giọng Nam Minh. Lỗi thì ném ra để bên gọi xử lý (đọc câu đó bằng chữ trên màn hình), không đổi giọng.
// prio 0 = câu sắp đọc (thử 6 lần, mỗi lần ≤ 6 giây — Edge hay trả rỗng ~25% lượt), 1–2 = tạo sẵn chạy nền (thử 8 lần)
export async function synthesizeTTS(text, { low, prio = low ? 2 : 0, voice = VOICE, ...opts } = {}){
  const usePy = await pyReady;
  await edgeSlot(prio);
  try { return { buf: usePy ? await pyEdge(text, VOICE, opts, prio ? 8 : 6) : await nodeEdge(text, VOICE, opts) }; }
  finally { edgeFree(); }
}

/* ---------- bộ nhớ đệm câu cố định ---------- */
const sg = v => `${v >= 0 ? '+' : ''}${v}`;
export const ttsOpts = () => ({ voice: VOICE, pitch: sg(settings.pitch) + 'Hz', rate: sg(settings.rate) + '%', volume: `+${settings.volume}%` });
export const cacheName = (text, o) => crypto.createHash('sha1').update(`thap1|${o.voice}|${o.pitch}|${o.rate}|${o.volume}|${text}`).digest('hex').slice(0, 24) + '.mp3';
export function cachedFile(text, o){ const f = path.join(CACHE_DIR, cacheName(text, o)); try { if (fs.statSync(f).size > 1000) return f; } catch {} return null; }
export function writeCache(text, o, buf){ try { fs.writeFileSync(path.join(CACHE_DIR, cacheName(text, o)), buf); } catch {} }

// Độ dài thật của file MP3 (giây): duyệt từng khung MPEG Layer 3, cộng số mẫu / tần số lấy mẫu.
// Chịu được file ghép nhiều đoạn, thẻ ID3 xen giữa, bitrate khác nhau (Edge 48 kbps, Google 32 kbps…).
// Trước đây ước lượng bytes/12000 (= 96 kbps) → câu Edge 48 kbps bị tính ngắn một nửa → câu sau (vd. cảm ơn quà) cắt ngang.
const BR1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], BR2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const SR = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
export function mp3Seconds(b){
  let i = 0, sec = 0, frames = 0;
  while (i + 4 <= b.length) {
    if (b[i] === 0x49 && b[i + 1] === 0x44 && b[i + 2] === 0x33 && i + 10 <= b.length) { i += 10 + ((b[i + 6] & 127) << 21 | (b[i + 7] & 127) << 14 | (b[i + 8] & 127) << 7 | (b[i + 9] & 127)); continue; }
    if (b[i] !== 0xFF || (b[i + 1] & 0xE0) !== 0xE0) { i++; continue; }
    const ver = (b[i + 1] >> 3) & 3, layer = (b[i + 1] >> 1) & 3, bri = b[i + 2] >> 4, sri = (b[i + 2] >> 2) & 3, pad = (b[i + 2] >> 1) & 1;
    if (ver === 1 || layer !== 1 || bri === 0 || bri === 15 || sri === 3) { i++; continue; }
    const br = (ver === 3 ? BR1 : BR2)[bri] * 1000, sr = SR[ver][sri];
    const len = Math.floor((ver === 3 ? 144 : 72) * br / sr) + pad;
    if (len < 4) { i++; continue; }
    sec += (ver === 3 ? 1152 : 576) / sr; frames++; i += len;
  }
  return frames ? sec : b.length / 6000;   // không đọc được khung nào → coi như 48 kbps
}

// Cắt im lặng đầu / cuối một đoạn MP3 của Edge để ghép tên + câu có sẵn đọc liền mạch.
// Edge chèn ~3 khung im lặng đầu và ~25 khung (≈0,6 giây) im lặng cuối mỗi đoạn → ghép "Giang" + "ơi, cảm ơn…" bị ngưng gần 1 giây.
// Khung im lặng nhận chính xác qua side info Layer III: part2_3_length = 0 (không có dữ liệu âm thanh).
// Từ ngắn (tên khách, "và"…): sau tiếng nói Edge còn ~1,1 giây TIẾNG NỀN rất nhỏ (global_gain đều ~133, tiếng nói 150–190),
// ngăn với tiếng nói bằng vài khung im lặng → bỏ luôn các "cụm" khung ở đầu / cuối mà không có khung nào đủ lớn (gain < LOUD).
// Giữ lại `head` khung trước tiếng nói: khung nói đầu tiên mượn dữ liệu (bit reservoir) tối đa ~255 byte của 2 khung trước nó.
// `tail` khung giữ sau tiếng nói = khoảng nghỉ tự nhiên (1 khung MPEG-2 24 kHz = 24 ms).
const LOUD = 150;
export function trimSilence(b, { head = 2, tail = 4 } = {}){
  const fr = [];
  let i = 0;
  while (i + 4 <= b.length) {
    if (b[i] === 0x49 && b[i + 1] === 0x44 && b[i + 2] === 0x33 && i + 10 <= b.length) { i += 10 + ((b[i + 6] & 127) << 21 | (b[i + 7] & 127) << 14 | (b[i + 8] & 127) << 7 | (b[i + 9] & 127)); continue; }
    if (b[i] !== 0xFF || (b[i + 1] & 0xE0) !== 0xE0) { i++; continue; }
    const ver = (b[i + 1] >> 3) & 3, layer = (b[i + 1] >> 1) & 3, prot = b[i + 1] & 1, bri = b[i + 2] >> 4, sri = (b[i + 2] >> 2) & 3, pad = (b[i + 2] >> 1) & 1;
    if (ver === 1 || layer !== 1 || bri === 0 || bri === 15 || sri === 3) { i++; continue; }
    const len = Math.floor((ver === 3 ? 144 : 72) * (ver === 3 ? BR1 : BR2)[bri] * 1000 / SR[ver][sri]) + pad;
    if (len < 4 || i + len > b.length) break;
    // part2_3_length: MPEG-1 bỏ 9 bit main_data_begin + 3–5 bit riêng + scfsi; MPEG-2 bỏ 8 bit + 1–2 bit riêng
    const s = i + 4 + (prot ? 0 : 2), mono = (b[i + 3] >> 6) === 3;
    const skip = ver === 3 ? 9 + (mono ? 5 : 3) + (mono ? 4 : 8) : 8 + (mono ? 1 : 2);
    // 6 byte side info đầu (48 bit, vẫn chính xác trong số thực): part2_3_length 12 bit → big_values 9 bit → global_gain 8 bit
    let v = 0; for (let k = 0; k < 6; k++) v = v * 256 + (b[s + k] ?? 0);
    const bits = (off, n) => Math.floor(v / 2 ** (48 - off - n)) % 2 ** n;
    const p23 = bits(skip, 12), gain = ver === 3 ? 255 : bits(skip + 21, 8);   // MPEG-1 (Node / 96 kbps 48 kHz không có) → chỉ xét im lặng
    fr.push({ at: i, len, quiet: p23 === 0, gain });
    i += len;
  }
  if (fr.length < 4 || fr.every(f => f.quiet)) return b;       // không đọc được / toàn im lặng → để nguyên
  // chia thành các cụm âm thanh, ngăn nhau bởi ≥ 2 khung im lặng; cụm "có tiếng nói" = có khung gain ≥ LOUD
  const runs = []; let q = 0;
  fr.forEach((f, k) => {
    if (f.quiet) { q++; return; }
    if (!runs.length || q >= 2) runs.push({ a: k, z: k, max: f.gain }); else { const r = runs[runs.length - 1]; r.z = k; r.max = Math.max(r.max, f.gain); }
    q = 0;
  });
  const voiced = runs.filter(r => r.max >= LOUD), use = voiced.length ? voiced : runs;
  let first = use[0].a, last = use[use.length - 1].z;
  // tiếng nền nhiều khi dính liền tiếng nói (không có khung im lặng ngăn) → cụm dài thêm ~1,2 giây, đọc tên xong bị nghỉ lâu.
  // Nên cắt tiếp tới khung đầu / cuối thật sự có tiếng nói (gain ≥ LOUD); phần đuôi nhỏ dần sau đó giữ bằng `tail`.
  if (voiced.length) {
    while (first < last && (fr[first].quiet || fr[first].gain < LOUD)) first++;
    while (last > first && (fr[last].quiet || fr[last].gain < LOUD)) last--;
  }
  const from = Math.max(0, first - head), to = Math.min(fr.length - 1, last + tail);
  return Buffer.concat(fr.slice(from, to + 1).map(f => b.subarray(f.at, f.at + f.len)));
}
// khoảng nghỉ sau mỗi đoạn khi ghép: hết câu (. ! ?) nghỉ dài hơn dấu phẩy, giữa tên với câu chỉ ngắt hơi; "tên ơi" = như dấu phẩy
const pauseAfter = (p, isLast) => isLast ? 6 : /[.!?…]$/.test(p.t) ? 9 : (p.oi || /[,;:]$/.test(p.t)) ? 5 : 3;

// "Bé mỡ" + "ơi, chào mừng bạn!…" → "Bé mỡ ơi" + "chào mừng bạn!…": tên và "ơi" đọc trong CÙNG một lượt Edge cho liền hơi.
// Ghép hai file riêng thì tên tự xuống giọng như hết câu → nghe ngắt trước chữ "ơi" dù khoảng lặng đã cắt sát.
const OI = /^ơi(?=[\s,!.?…]|$)[\s,!.?…]*/iu;
export const stripOi = t => String(t).replace(OI, '');
export function joinOi(parts){
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i], n = parts[i + 1];
    if (n && OI.test(n.t) && !/[.!?…,;:]$/.test(p.t)) {
      out.push({ t: `${p.t} ơi`, nc: p.nc, oi: true });
      const rest = stripOi(n.t); if (rest) out.push({ t: rest, nc: n.nc });
      i++;
    } else out.push(p);
  }
  return out;
}

async function segBuf(p, o){
  if (!p.nc) { const hit = cachedFile(p.t, o); if (hit) return fs.readFileSync(hit); }
  let buf, err;
  try { buf = (await synthesizeTTS(p.t, { ...o })).buf; } catch (e) { err = e; } 
  if (!buf) throw err;
  if (!p.nc) writeCache(p.t, o, buf);
  return buf;
}
function pruneTTS(){ try { const old = fs.readdirSync(TTS_DIR).sort(); while (old.length > 60) fs.unlinkSync(path.join(TTS_DIR, old.shift())); } catch {} }
let ttsSeq = 0;
async function build(parts, o){
  let buf;
  try {
    parts = joinOi(parts);
    const bufs = await Promise.all(parts.map(p => segBuf(p, o)));
    // cắt im lặng thừa từng đoạn rồi ghép → đọc liền mạch (kể cả câu 1 đoạn: bớt ~0,6 giây im lặng cuối, câu sau tới sớm hơn)
    buf = Buffer.concat(bufs.map((b, i) => trimSilence(b, { tail: pauseAfter(parts[i], i === bufs.length - 1) })));
  } catch { buf = trimSilence((await synthesizeTTS(parts.map(p => p.t).join(' '), { ...o })).buf, { tail: 6 }); }
  const file = `tts_${Date.now()}_${++ttsSeq}.mp3`;
  fs.writeFileSync(path.join(TTS_DIR, file), buf); pruneTTS();
  return { url: `/tts/${file}`, bytes: buf.length, sec: mp3Seconds(buf) };
}
// chuẩn bị file âm thanh ngay khi câu vào hàng đợi (đọc tới là có sẵn)
const prepMemo = new Map();
// TSBD_FAKE_TTS=1: chế độ thử khi đang LIVE — không gọi Edge (không tranh giọng với app thật), câu chỉ hiện chữ, độ dài ước theo số chữ
export const FAKE_TTS = process.env.TSBD_FAKE_TTS === '1';
export function prepare(x){
  if (FAKE_TTS) { const t = partsOf(x).map(p => p.t).join(' '); return Promise.resolve({ url: '', bytes: 0, sec: Math.max(1.5, t.length / 16) }); }
  const parts = partsOf(x), o = ttsOpts(), key = JSON.stringify([o, parts]);
  let pr = prepMemo.get(key);
  if (!pr) { pr = build(parts, o); prepMemo.set(key, pr); pr.catch(() => prepMemo.delete(key)); setTimeout(() => prepMemo.delete(key), 180_000).unref(); }
  return pr;
}

// người xem mới → tạo sẵn giọng đọc tên (đúng giọng đang chọn) để lúc cảm ơn/chào là đọc ngay; tên đã có thì bỏ qua
const nameJobs = new Set();
export function prefetchName(name){
  const t = String(name || '').trim(), o = ttsOpts();
  if (FAKE_TTS || !t) return;
  for (const s of [t, `${t} ơi`]) {   // "tên ơi" dùng khi chào / cảm ơn quà (xem joinOi)
    if (cachedFile(s, o) || nameJobs.has(s) || edgeWait[1].length > 40) continue;
    nameJobs.add(s);
    synthesizeTTS(s, { ...o, prio: 1 }).then(({ buf }) => writeCache(s, o, buf)).catch(() => {}).finally(() => nameJobs.delete(s));
  }
}
