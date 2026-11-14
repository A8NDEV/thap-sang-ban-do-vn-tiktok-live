// Máy chủ tĩnh cục bộ chỉ dùng để đo hiệu năng (tools/fx-bench.html).
// Chỉ lắng nghe 127.0.0.1, chỉ phục vụ /public/ và /tools/. KHÔNG đụng tới data/.
// Chạy: node tools/serve-static.mjs [--port 5173]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALLOWED = ['public/', 'tools/'];
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

// Giải mã %xx rồi ghép vào root; trả null nếu thoát khỏi root, chứa NUL, mã hóa sai, hoặc chính là root.
export function resolveSafe(root, urlPath) {
  let decoded;
  try { decoded = decodeURIComponent(String(urlPath)); } catch { return null; }
  if (decoded.includes('\0')) return null;
  const base = path.resolve(root);
  const full = path.resolve(base, '.' + (decoded.startsWith('/') ? decoded : '/' + decoded));
  if (!full.startsWith(base + path.sep)) return null;
  return full;
}

function handle(req, res) {
  const send = (code, body, type = 'text/plain; charset=utf-8') => {
    res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(body);
  };
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, 'Method Not Allowed');
  const urlPath = String(req.url || '/').split(/[?#]/)[0];
  const file = resolveSafe(ROOT, urlPath);
  if (!file) return send(404, 'Not Found');
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  if (!ALLOWED.some(p => rel.startsWith(p))) return send(404, 'Not Found');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(404, 'Not Found');
    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Cache-Control': 'no-store' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--port');
  const port = i > 0 ? Number(process.argv[i + 1]) : 5173;
  http.createServer(handle).listen(port, '127.0.0.1', () => {
    console.log(`serve-static: http://127.0.0.1:${port}/tools/fx-bench.html`);
  });
}
