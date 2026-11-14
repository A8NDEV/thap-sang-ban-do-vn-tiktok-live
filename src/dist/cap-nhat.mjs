// ============================================================================
// PHÂN PHỐI — CẬP NHẬT BẢN MỚI ngay trong trang điều khiển (chuyển từ Sàn Quẩy cap-nhat.js).
//   - Kiểm tra / tải đều gửi giấy kích hoạt (Bearer) lên vn-tool.online → máy chủ xác nhận key còn hợp lệ
//     trên máy này mới trả thông tin / truyền tệp zip (không có link tải công khai).
//   - Tải zip (tải tiếp khi đứt mạng, Range) → kiểm tra SHA-256 → giải nén ra thư mục tạm → chép đè MÃ CHƯƠNG TRÌNH,
//     giữ nguyên dữ liệu người dùng: data/** (cài đặt, điểm, Chủ tỉnh, bản quyền, giọng đã tạo), nhac/**.
//   - Xong thì tắt server; CHAY.bat tự chạy lại server với mã mới.
// Chỉ chép đè ở bản thư mục (CHAY.bat). Máy phát triển / bản Electron portable: chỉ kiểm tra, báo tải bản mới.
// ============================================================================
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const BUSY = [429, 500, 502, 503, 504, 520, 521, 522, 523, 524];
const RETRY = [3000, 5000, 8000, 10000, 15000, 20000, 30000, 30000, 45000, 45000, 60000, 60000];
const STALL_MS = 60000;
const wait = ms => new Promise(r => setTimeout(r, ms));
const hard = msg => Object.assign(new Error(msg), { hard: true });   // thử lại cũng vô ích (key bị từ chối, VPN…)

// "2026.11.09.2" > "2026.11.09.1" (so từng số)
export function newer(a, b){
  const x = String(a || '').split('.').map(n => parseInt(n, 10) || 0), y = String(b || '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}
// Quyết định 1 tệp của bản mới (đường dẫn tương đối, dấu /): 'skip' | 'add' (chỉ thêm nếu chưa có) | 'put' (chép đè)
export function rule(rel){
  if (rel.startsWith('data/') || rel.startsWith('nhac/')) return 'skip';     // dữ liệu người dùng
  if (rel.startsWith('.git/') || rel.endsWith('.bak') || rel.includes('/.')) return 'skip';
  if (rel === 'node.exe') return 'skip';                                   // Node chạy kèm đang chạy (bị khóa) — chỉ có khi tải bản mới đầy đủ
  return 'put';
}
export function readVersion(root){ try { return JSON.parse(fs.readFileSync(path.join(root, 'phien-ban.json'), 'utf8')).version || ''; } catch { return ''; } }

export function createUpdater({ appDir, version, license, devMachine = false, onRestart }){
  // Bản thư mục chạy bằng CHAY.bat (node thường) mới tự chép đè được; Electron portable giải nén ra thư mục tạm mỗi lần chạy.
  const inPlace = !devMachine && !process.versions.electron && fs.existsSync(path.join(appDir, 'CHAY.bat'));
  const work = path.join(os.tmpdir(), 'ThapSangBanDo-cap-nhat');
  const st = { stage: 'idle', pct: 0, msg: '', latest: '', error: '' };
  const set = (stage, msg, pct = 0) => Object.assign(st, { stage, msg, pct, error: '' });

  async function check(){
    const r = await license.checkUpdate();
    if (!r.ok) return { ok: false, error: r.message, code: r.code };
    st.latest = r.version || '';
    return { ok: true, current: version, latest: r.version || '', notes: r.notes, size: r.size, hasUpdate: !!r.version && newer(r.version, version), inPlace, info: r };
  }

  // Tải zip chịu được mạng chập chờn: 60 giây không có byte nào → nối lại; đứt giữa chừng → tải TIẾP (Range)
  async function download(size, file){
    const MB = n => (n / 1048576).toFixed(1);
    let total = size || 0, fails = 0;
    for (;;) {
      let got = fs.existsSync(file) ? fs.statSync(file).size : 0;
      if (total && got >= total) break;
      const before = got, ac = new AbortController(); let idle;
      const kick = () => { clearTimeout(idle); idle = setTimeout(() => ac.abort(new Error('60 giây không nhận được dữ liệu')), STALL_MS); };
      try {
        kick();
        const res = await license.fetchRelease(got, ac.signal);
        if (license.cfBlocked(res)) throw hard(license.VPN_MSG);
        if (BUSY.includes(res.status)) throw new Error(`máy chủ bận (HTTP ${res.status})`);
        if (res.status === 416) { fs.rmSync(file, { force: true }); continue; }   // tệp dở không khớp → tải lại từ đầu
        if (!res.ok || !res.body) { const j = await res.json().catch(() => ({})); throw hard(j.message || `Tải bản mới lỗi (HTTP ${res.status})`); }
        const append = res.status === 206 && got > 0;
        if (!append) got = 0;
        const len = Number(res.headers.get('content-length')) || 0;
        if (len) total = got + len;
        const src = Readable.fromWeb(res.body);
        src.on('data', c => { kick(); got += c.length; st.pct = total ? Math.min(99, Math.round(got / total * 100)) : 0; st.msg = `Đang tải bản mới… ${MB(got)}${total ? ` / ${MB(total)}` : ''} MB`; });
        await pipeline(src, fs.createWriteStream(file, { flags: append ? 'a' : 'w' }));
        clearTimeout(idle);
        if (!total || got >= total) break;
        throw new Error('bị ngắt giữa chừng');
      } catch (e) {
        clearTimeout(idle);
        if (e.hard) throw e;
        const now = fs.existsSync(file) ? fs.statSync(file).size : 0;
        fails = now > before ? 1 : fails + 1;
        if (fails > RETRY.length) throw new Error(`Mạng chập chờn, tải bản mới chưa xong (${MB(now)} MB) — bấm cập nhật lại để tải tiếp, không phải tải lại từ đầu.`);
        st.msg = `Mạng chập chờn (${e.cause?.code || e.message}) — chờ ${RETRY[fails - 1] / 1000} giây rồi tải tiếp từ ${MB(now)} MB…`;
        await wait(RETRY[fails - 1]);
      }
    }
    const hash = crypto.createHash('sha256');
    for await (const c of fs.createReadStream(file)) hash.update(c);
    return hash.digest('hex');
  }

  const unzip = (zip, dir) => new Promise((ok, fail) => execFile('powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', `Expand-Archive -LiteralPath '${zip.replace(/'/g, "''")}' -DestinationPath '${dir.replace(/'/g, "''")}' -Force`],
    { windowsHide: true, timeout: 15 * 60 * 1000 }, e => e ? fail(new Error('Giải nén bản mới lỗi: ' + e.message)) : ok()));

  // thư mục gốc của bản mới trong zip: nơi có server.mjs + src/dist/cap-nhat.mjs
  function findRoot(dir, depth = 0){
    if (fs.existsSync(path.join(dir, 'server.mjs')) && fs.existsSync(path.join(dir, 'src', 'dist', 'cap-nhat.mjs'))) return dir;
    if (depth > 2) return '';
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) if (e.isDirectory()) { const r = findRoot(path.join(dir, e.name), depth + 1); if (r) return r; }
    return '';
  }
  function walk(dir, base = dir, out = []){
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, base, out); else out.push(path.relative(base, p).split(path.sep).join('/'));
    }
    return out;
  }
  // chép bản mới vào appDir theo rule(); trả về số tệp chép / thêm / lỗi (tách riêng để test được)
  function copyTree(newRoot){
    let put = 0, added = 0; const failed = [];
    for (const rel of walk(newRoot)) {
      const r = rule(rel); if (r === 'skip') continue;
      const dst = path.join(appDir, ...rel.split('/'));
      if (r === 'add' && fs.existsSync(dst)) continue;
      try { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(path.join(newRoot, ...rel.split('/')), dst); r === 'add' ? added++ : put++; }
      catch { failed.push(rel); }
    }
    return { put, added, failed };
  }

  async function apply(){
    if (!['idle', 'error', 'done'].includes(st.stage)) throw new Error('Đang cập nhật, chờ chút…');
    if (!inPlace) {
      const why = devMachine ? 'Máy phát triển: chỉ kiểm tra, không chép đè mã nguồn.' : 'Bản app (.exe) không tự chép đè được — tải bản mới bằng link trong email mua hàng ở vn-tool.online.';
      Object.assign(st, { stage: 'error', error: why, msg: '' }); throw new Error(why);
    }
    set('check', 'Đang kiểm tra key và phiên bản…');
    let downloaded = false;
    try {
      const c = await check();
      if (!c.ok) throw new Error(c.error);
      if (!c.hasUpdate) throw new Error(`Đang dùng bản mới nhất (${version}).`);
      const zipName = `ban-moi-${String(c.info.sha256 || c.latest).slice(0, 16).replace(/[^a-z0-9.]/gi, '')}.zip`;
      fs.mkdirSync(work, { recursive: true });
      for (const e of fs.readdirSync(work)) if (e !== zipName) fs.rmSync(path.join(work, e), { recursive: true, force: true });
      const zip = path.join(work, zipName);
      set('download', 'Đang tải bản mới…');
      const sum = await download(c.info.size, zip);
      if (c.info.sha256 && sum !== c.info.sha256.toLowerCase()) { fs.rmSync(zip, { force: true }); throw new Error('Tệp tải về bị lỗi (sai mã kiểm tra) — bấm cập nhật lại.'); }
      downloaded = true;
      set('extract', 'Đang giải nén…', 100);
      const out = path.join(work, 'giai-nen');
      await unzip(zip, out);
      const nr = findRoot(out);
      if (!nr) throw new Error('Tệp tải về không đúng cấu trúc bản Thắp Sáng Bản Đồ.');
      set('copy', 'Đang chép bản mới (giữ nguyên dữ liệu của bạn)…', 100);
      const { put, added, failed } = copyTree(nr);
      fs.rmSync(work, { recursive: true, force: true });
      console.log(`[Cập nhật] ${version} → ${c.latest}: chép ${put} tệp, thêm ${added} tệp${failed.length ? `, lỗi ${failed.length}` : ''}`);
      if (failed.length) throw new Error(`Không chép được ${failed.length} tệp (${failed.slice(0, 3).join(', ')}…) — tắt tool rồi bấm cập nhật lại.`);
      set('restart', `Đã cập nhật lên ${c.latest} — đang mở lại…`, 100);
      if (process.env.TSBD_UPDATE_NO_RESTART !== '1') setTimeout(() => onRestart?.(), 1500);
      return { ok: true, version: c.latest, put, added };
    } catch (e) {
      if (downloaded) fs.rmSync(work, { recursive: true, force: true });   // lỗi khi đang tải → giữ tệp dở để tải tiếp
      Object.assign(st, { stage: 'error', error: e.message, msg: '' });
      throw e;
    }
  }

  return { check, apply, copyTree, status: () => ({ ...st, current: version, inPlace }) };
}
