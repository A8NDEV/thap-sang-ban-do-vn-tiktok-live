// ============================================================================
// PHÂN PHỐI — TẢI DỮ LIỆU QUAN TRỌNG TỪ MÁY CHỦ (chuyển từ Sàn Quẩy tai-anh.js): không đóng gói theo app, phải có key mới tải.
//   - Gói giọng MC tạo sẵn (data/tts_cache/<24 hex>.mp3): khỏi chờ Edge tạo hàng trăm câu, đọc ngay từ lần đầu.
//   - Nhạc nền mẫu (nhac/nhac-*.mp3).
//   - Gói giao diện 7 style màn hình LIVE (data/giao-dien.pak, xem giao-dien.mjs) — tải TRƯỚC để khách chọn style được ngay.
//   - Mỗi lần lấy danh sách / tải tệp đều gửi giấy kích hoạt; máy chủ kiểm tra key + máy rồi mới trả (không có link công khai).
//   - Chỉ tải tệp còn thiếu hoặc máy chủ vừa đổi; tệp người dùng tự sửa thì giữ. Ghi nhớ ở data/du-lieu-tai.json { tên: sha256 }.
//   Danh sách máy chủ: { files: [{ p: tên tệp, s: số byte, h: sha256 }] } — tạo bằng: npm run goi-giong
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { PAK_NAME } from './giao-dien.mjs';

const LANES = 3;   // ít luồng + chờ khi máy chủ bận: tải dồn quá nhanh dễ bị hosting / Cloudflare chặn tạm IP
const BUSY = [429, 500, 502, 503, 504, 520, 521, 522, 523, 524];
const RETRY = [3000, 8000, 20000, 45000, 60000];
const STALL_MS = +process.env.TSBD_STALL_MS || 60000;   // bao lâu không nhận được byte nào thì coi là đứt
const AUTO_WAIT = 60000, AUTO_MAX = 30;   // cả lượt dừng vì mạng → tự tải tiếp sau 60 giây, tối đa 30 lần
const wait = ms => new Promise(r => setTimeout(r, ms));
const hard = msg => Object.assign(new Error(msg), { hard: true });
const NET = ['UND_ERR_SOCKET', 'ECONNRESET', 'ECONNREFUSED', 'ECONNABORTED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH', 'EPIPE', 'UND_ERR_CONNECT_TIMEOUT'];
const errText = e => {
  if (!e) return 'lỗi mạng';
  if (e.name === 'TimeoutError' || e.name === 'AbortError' || /60 giây/.test(e.message)) return 'quá lâu không nhận được dữ liệu';
  const code = e.cause?.code || e.code || '';
  if (NET.includes(code) || /fetch failed|terminated|ECONNRESET|socket/i.test(e.message)) return 'mất kết nối mạng';
  return code || e.message || 'lỗi mạng';
};
const mb = n => (n / 1048576).toFixed(1);
const sha = buf => crypto.createHash('sha256').update(buf).digest('hex');

// tên tệp → thư mục đích (tên lạ thì bỏ qua: không để máy chủ ghi đè tệp tùy ý)
export function destOf(p, { cacheDir, musicDir, dataDir }){
  if (p === PAK_NAME) return dataDir || '';
  if (/^[0-9a-f]{24}\.mp3$/.test(p)) return cacheDir;
  if (/^nhac-[a-z0-9-]{1,80}\.mp3$/.test(p)) return musicDir;
  return '';
}

export function createDataSync({ dataDir, cacheDir, musicDir, license, onChange }){
  const dirs = { cacheDir, musicDir, dataDir };
  const recFile = path.join(dataDir, 'du-lieu-tai.json');
  let rec = {}; try { rec = JSON.parse(fs.readFileSync(recFile, 'utf8')) || {}; } catch {}
  const saveRec = () => { fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(recFile, JSON.stringify(rec)); };
  const st = { stage: 'idle', msg: '', error: '', done: 0, total: 0, bytes: 0, bytesTotal: 0, pct: 0, skipped: 0 };
  const view = () => ({ ...st });
  const progress = () => `Đang tải style màn hình, giọng MC, nhạc mẫu… ${st.pct}% (${st.done}/${st.total} tệp, ${mb(st.bytes)}/${mb(st.bytesTotal)} MB)`;
  const busy = () => ['list', 'download'].includes(st.stage);
  let autoTimer = null, autoTries = 0;

  // tệp nào cần tải: thiếu, hoặc máy chủ đổi mà người dùng chưa sửa; người dùng xóa nhạc mẫu thì không tải lại
  function plan(files){
    const need = []; let skipped = 0;
    for (const f of files) {
      const dir = destOf(f.p, dirs);
      if (!dir || !/^[0-9a-f]{64}$/.test(f.h)) continue;
      const file = path.join(dir, f.p);
      if (!fs.existsSync(file)) { if (dir === musicDir && rec[f.p]) skipped++; else need.push(f); continue; }
      const cur = sha(fs.readFileSync(file));
      if (cur === f.h) { rec[f.p] = f.h; continue; }
      if (rec[f.p] && rec[f.p] === cur) need.push(f); else skipped++;
    }
    return { need, skipped };
  }
  // Tải 1 tệp chịu được mạng chậm / chập chờn (giống bộ cập nhật):
  //   - chỉ ngắt khi 60 giây KHÔNG nhận thêm byte nào (mạng chậm vẫn tải xong tệp lớn, không giới hạn tổng thời gian)
  //   - ghi dần vào .<tên>.tai; đứt giữa chừng → tải TIẾP từ byte đã có (Range), máy chủ không hỗ trợ thì tải lại từ đầu
  //   - % tiến độ tăng theo từng đoạn dữ liệu; có tiến triển thì đếm lại số lần thử
  async function fetchOne(f){
    const dir = destOf(f.p, dirs);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = path.join(dir, `.${f.p}.tai`), dst = path.join(dir, f.p);
    const size = () => { try { return fs.statSync(tmp).size; } catch { return 0; } };
    let counted = 0, fails = 0;
    const count = n => { st.bytes += n - counted; counted = n; st.pct = st.bytesTotal ? Math.min(100, Math.round(st.bytes / st.bytesTotal * 100)) : 0; if (!waiting) st.msg = progress(); };
    let waiting = false;
    for (;;) {
      let got = size();
      if (got > f.s) { fs.rmSync(tmp, { force: true }); got = 0; }
      count(got);
      const before = got, ac = new AbortController(); let idle;
      const kick = () => { clearTimeout(idle); idle = setTimeout(() => ac.abort(new Error('60 giây không nhận được dữ liệu')), STALL_MS); };
      try {
        kick();
        const res = await license.fetchPart(f.p, got, ac.signal);
        if (license.cfBlocked(res)) throw hard(license.VPN_MSG);
        if (BUSY.includes(res.status)) throw new Error(`máy chủ bận (HTTP ${res.status})`);
        if (res.status === 416) { fs.rmSync(tmp, { force: true }); throw new Error('tệp dở không khớp, tải lại'); }
        if (!res.ok || !res.body) { const j = await res.json().catch(() => ({})); throw hard(j.message || `Tải ${f.p} lỗi (HTTP ${res.status})`); }
        const append = res.status === 206 && got > 0;
        if (!append) { got = 0; count(0); }
        const src = Readable.fromWeb(res.body);
        src.on('data', c => { kick(); got += c.length; count(got); });
        await pipeline(src, fs.createWriteStream(tmp, { flags: append ? 'a' : 'w' }));
        clearTimeout(idle);
        if (got < f.s) throw new Error('bị ngắt giữa chừng');
        if (sha(fs.readFileSync(tmp)) !== f.h) { fs.rmSync(tmp, { force: true }); count(0); throw new Error('tải về bị sai mã kiểm tra'); }
        fs.renameSync(tmp, dst);
        break;
      } catch (e) {
        clearTimeout(idle);
        if (e.hard) throw e;
        fails = size() > before ? 1 : fails + 1;
        if (fails > RETRY.length) throw new Error(`Mạng chập chờn — không tải được ${f.p} (${errText(e)}); phần đã tải được giữ lại`);
        const why = errText(e);
        st.msg = `${why[0].toUpperCase() + why.slice(1)} — chờ ${RETRY[fails - 1] / 1000} giây rồi tải tiếp… ${st.pct}% (${st.done}/${st.total} tệp)`;
        waiting = true; await wait(RETRY[fails - 1]); waiting = false;
      }
    }
    rec[f.p] = f.h;
    if (f.p === PAK_NAME) onChange?.();   // có gói giao diện → báo trang điều khiển mở khóa style ngay
  }

  async function sync(auto = false){
    if (busy()) return view();
    clearTimeout(autoTimer); autoTimer = null;
    if (!auto) autoTries = 0;
    Object.assign(st, { stage: 'list', msg: 'Đang hỏi máy chủ danh sách dữ liệu…', error: '', done: 0, total: 0, bytes: 0, bytesTotal: 0, pct: 0, skipped: 0 });
    try {
      const m = await license.assetList();
      if (!m.ok) throw m.busy && !m.vpn ? new Error(m.message || 'Không kết nối được máy chủ') : hard(m.message || 'Máy chủ từ chối');
      const { need, skipped } = plan(m.files || []);
      need.sort((a, b) => (b.p === PAK_NAME) - (a.p === PAK_NAME));   // gói giao diện trước
      Object.assign(st, { skipped, total: need.length, bytesTotal: need.reduce((a, f) => a + (+f.s || 0), 0) });
      if (!need.length) { saveRec(); Object.assign(st, { stage: 'done', pct: 100, msg: 'Dữ liệu đã đầy đủ.' }); onChange?.(); return view(); }
      st.stage = 'download';
      let i = 0, failed = null;
      const lane = async () => { while (!failed && i < need.length) { const f = need[i++]; try { await fetchOne(f); } catch (e) { failed = e; return; } st.done++; st.msg = progress(); } };
      await Promise.all(Array.from({ length: LANES }, lane));
      saveRec();
      if (failed) throw failed;
      Object.assign(st, { stage: 'done', pct: 100, msg: `Đã tải xong ${st.total} tệp (${mb(st.bytes)} MB).` });
      autoTries = 0;
    } catch (e) {
      if (!e.hard && autoTries < AUTO_MAX) {
        autoTries++;
        Object.assign(st, { stage: 'wait', error: '', msg: `Mạng chập chờn — tự tải tiếp sau ${AUTO_WAIT / 1000} giây${st.done ? ` (đã tải ${st.done}/${st.total} tệp)` : ''}. Lỗi: ${e.message}` });
        autoTimer = setTimeout(() => sync(true), AUTO_WAIT); autoTimer.unref?.();
      } else Object.assign(st, { stage: 'error', error: e.hard ? e.message : `${e.message} — kiểm tra mạng rồi bấm tải lại, tệp đã tải không mất.`, msg: '' });
    }
    onChange?.();   // báo trạng thái CUỐI (xong / chờ tải tiếp / lỗi) về trang điều khiển
    return view();
  }
  return { sync, status: view, busy };
}
