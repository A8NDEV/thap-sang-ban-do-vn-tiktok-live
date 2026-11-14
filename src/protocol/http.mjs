// TẦNG 2 — HTTP: phục vụ trang (public/), giọng đọc (data/tts*), nhạc (nhac/) và POST /rpc.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { PUBLIC_DIR, TTS_DIR, CACHE_DIR, MUSIC_DIR } from '../core/paths.mjs';
import { MUSIC_RE, MUSIC_MAX, saveMusic } from '../audio/music.mjs';
import { okHost, okOrigin, isAuthorized, authCookie, isLoopback, PHONE_PATHS } from './auth.mjs';
import { handleRpc, parseError } from './rpc.mjs';
import { styles } from '../dist/giao-dien.mjs';

const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.mp3':'audio/mpeg', '.m4a':'audio/mp4', '.ogg':'audio/ogg', '.wav':'audio/wav', '.aac':'audio/aac', '.svg':'image/svg+xml', '.ico':'image/x-icon' };
const SEC = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };

function resolveStatic(p){
  const segs = p.split('/').filter(Boolean);
  if (!segs.length || segs.some(s => s.startsWith('.') || s.includes('\\') || s.includes(':'))) return null;
  if (segs.length === 2 && segs[0] === 'tts' && /^[\w.]+\.mp3$/.test(segs[1])) return path.join(TTS_DIR, segs[1]);
  if (segs.length === 2 && segs[0] === 'tts_cache' && /^[\w.]+\.mp3$/.test(segs[1])) return path.join(CACHE_DIR, segs[1]);
  if (segs.length === 2 && segs[0] === 'nhac' && MUSIC_RE.test(segs[1])) return path.join(MUSIC_DIR, segs[1]);
  const f = path.join(PUBLIC_DIR, ...segs);
  return f.startsWith(PUBLIC_DIR + path.sep) && MIME[path.extname(f).toLowerCase()] ? f : null;
}

function sendFile(req, res, file){
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404).end('not found'); return; }
    const head = { ...SEC, 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (m && (m[1] || m[2])) {      // nhạc nền dài: cho trình duyệt tải từng đoạn
      const start = m[1] ? +m[1] : Math.max(0, st.size - +m[2]), end = m[1] && m[2] ? Math.min(+m[2], st.size - 1) : st.size - 1;
      if (start >= st.size || start > end) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }).end(); return; }
      res.writeHead(206, { ...head, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
      if (req.method === 'HEAD') { res.end(); return; }
      fs.createReadStream(file, { start, end }).pipe(res); return;
    }
    res.writeHead(200, { ...head, 'Content-Length': st.size });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  });
}

const NEED_TOKEN = `<!doctype html><meta charset="utf-8"><title>Cần mã truy cập</title>
<body style="font:16px system-ui;background:#0d1526;color:#e7eefc;padding:40px;max-width:640px;margin:auto">
<h2 style="color:#ffc94a">🔒 Bảng điều khiển cần mã truy cập</h2>
<p>Trên máy đang chạy tool: mở <b>http://localhost:3002/control.html</b> là vào thẳng (không cần mã).</p>
<p>Hoặc dán mã <code>rpcToken</code> trong file <code>data/app-config.json</code>:</p>
<form onsubmit="location.href='/control.html?token='+encodeURIComponent(this.t.value.trim());return false"><input name="t" style="width:70%;padding:8px" autofocus> <button style="padding:8px 14px">Mở</button></form>`;

function readBody(req, limit = 64 * 1024){
  return readRaw(req, limit).then(b => b.toString('utf8'));
}
function readRaw(req, limit){
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export function createHttpServer({ port }){
  return http.createServer(async (req, res) => {
    if (!okHost(req.headers.host)) { res.writeHead(421).end('wrong host'); return; }
    let url; try { url = new URL(req.url, 'http://x'); } catch { res.writeHead(400).end(); return; }
    let p; try { p = decodeURIComponent(url.pathname); } catch { res.writeHead(400).end(); return; }

    // điện thoại / máy khác trong mạng: chỉ GET màn hình bản đồ (giống Sàn Quẩy)
    if (!isLoopback(req) && !((req.method === 'GET' || req.method === 'HEAD') && PHONE_PATHS.test(p))) { res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Trang này chỉ mở được trên máy đang chạy Thắp Sáng Bản Đồ.'); return; }
    if (p === '/rpc') {
      if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST' }).end(); return; }
      if (!okOrigin(req.headers.origin)) { res.writeHead(403).end(); return; }
      if (!isAuthorized(req, url)) { res.writeHead(401, { 'Content-Type': 'application/json' }).end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Unauthorized: thiếu hoặc sai token' } })); return; }
      let body; try { body = await readBody(req); } catch { res.writeHead(413).end(); return; }
      let msg; try { msg = JSON.parse(body); } catch { res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify(parseError())); return; }
      const out = await handleRpc(msg);
      if (!out) { res.writeHead(204).end(); return; }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }).end(JSON.stringify(out));
      return;
    }
    // tải nhạc nền lên: thân = nội dung file, tên ở header X-File-Name (encodeURIComponent). Cần token như /rpc.
    if (p === '/upload/nhac') {
      const J = (code, o) => res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }).end(JSON.stringify(o));
      if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST' }).end(); return; }
      if (!okOrigin(req.headers.origin)) { res.writeHead(403).end(); return; }
      if (!isAuthorized(req, url)) { J(401, { error: 'Thiếu hoặc sai token' }); return; }
      if (+req.headers['content-length'] > MUSIC_MAX) { J(413, { error: 'File quá 50 MB' }); req.destroy(); return; }
      let buf; try { buf = await readRaw(req, MUSIC_MAX); } catch { J(413, { error: 'File quá 50 MB' }); return; }
      let name = ''; try { name = decodeURIComponent(String(req.headers['x-file-name'] || '')); } catch {}
      try { J(200, saveMusic(name, buf)); } catch (e) { J(400, { error: e.message }); }
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
    if (p === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, app: 'thap-sang-ban-do', port })); return; }
    if (p === '/') { res.writeHead(302, { Location: '/control.html' }).end(); return; }
    if (p === '/control.html') {
      // có ?token đúng → cấp cookie rồi chuyển về URL sạch (không lộ token khi chia sẻ màn hình)
      if (url.searchParams.has('token')) {
        if (isAuthorized(req, url)) { res.writeHead(302, { 'Set-Cookie': authCookie(), Location: '/control.html' }).end(); return; }
        res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' }).end(NEED_TOKEN); return;
      }
      if (!isAuthorized(req, null) && isLoopback(req)) res.setHeader('Set-Cookie', authCookie());   // cấp cookie kèm trang, không chuyển hướng (tránh vòng lặp nếu chặn cookie)
      else if (!isAuthorized(req, null)) { res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' }).end(NEED_TOKEN); return; }
    }
    if (p.startsWith('/style/')) {   // gói giao diện (tải sau khi kích hoạt key) — thiếu thì 404, overlay tự dùng style mặc định
      const body = styles.file(p.slice(7));
      if (body === null) { res.writeHead(404, SEC).end('not found'); return; }
      const buf = Buffer.from(body, 'utf8');
      res.writeHead(200, { ...SEC, 'Content-Type': MIME[path.extname(p)], 'Cache-Control': 'no-store', 'Content-Length': buf.length });
      res.end(req.method === 'HEAD' ? undefined : buf); return;
    }
    const file = resolveStatic(p);
    if (!file) { res.writeHead(404).end('not found'); return; }
    sendFile(req, res, file);
  });
}
