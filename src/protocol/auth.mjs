// TẦNG 2 — bảo mật: chỉ nhận yêu cầu gửi tới localhost (chống DNS rebinding) + token cho mọi lệnh điều khiển.
// Token nhận qua: header "Authorization: Bearer <token>", "X-Access-Token", ?token=..., hoặc cookie httpOnly
// (cookie được cấp khi mở control.html?token=... lần đầu → URL sau đó không còn lộ token trên màn hình live).
import crypto from 'node:crypto';
import os from 'node:os';

const COOKIE = 'tsbd_token';
let TOKEN = '', PORT = 0, ALLOWED = new Set(), LAN = false;
export const OBS_DOMAIN = /^[a-z0-9-]+.test$/.test(process.env.TSBD_DOMAIN || '') ? process.env.TSBD_DOMAIN : 'thapsang.test';
export const lanIps = () => Object.values(os.networkInterfaces()).flat().filter(n => n && n.family === 'IPv4' && !n.internal && !n.address.startsWith('169.254.')).map(n => n.address);

export function configureAuth({ token, port, lan = false }){
  TOKEN = token; PORT = port; LAN = lan;
  // tên miền riêng cho OBS (thapsang.test trong file hosts) luôn được nhận; IP mạng nội bộ chỉ khi bật chế độ điện thoại
  ALLOWED = new Set([`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`, `${OBS_DOMAIN}:${port}`]);
}
export const isLan = () => LAN;
export const setLan = on => { LAN = !!on; };   // bật / tắt chế độ điện thoại lúc đang chạy (phone-mode.mjs)
export const okHost = h => { h = String(h || '').toLowerCase(); return ALLOWED.has(h) || (LAN && lanIps().some(ip => h === `${ip}:${PORT}`)); };
// máy khác trong mạng (điện thoại) chỉ được XEM màn hình bản đồ: overlay + tài nguyên của nó + giọng + nhạc
export const PHONE_PATHS = /^\/(?:overlay\.html|health|css\/(?:overlay|themes[\w-]*)\.css|style\/[\w-]+\.(?:css|js)|js\/rpc-client\.js|js\/overlay\/[\w-]+\.js|data\/[\w-]+\.js|tts\/[\w.-]+|tts_cache\/[\w.-]+|nhac\/[^/]+|favicon\.ico)$/;
export function okOrigin(origin){ if (!origin) return true; try { return okHost(new URL(origin).host); } catch { return false; } }

function cookieToken(req){
  for (const part of String(req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return decodeURIComponent(v.join('='));
  }
  return '';
}
export function tokenFrom(req, url){
  const h = String(req.headers.authorization || '');
  if (/^Bearer\s+/i.test(h)) return h.replace(/^Bearer\s+/i, '').trim();
  if (req.headers['x-access-token']) return String(req.headers['x-access-token']).trim();
  const q = url?.searchParams.get('token'); if (q) return q.trim();
  return cookieToken(req);
}
export function checkToken(t){
  if (!TOKEN || !t) return false;
  const a = Buffer.from(String(t)), b = Buffer.from(TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export const isAuthorized = (req, url) => checkToken(tokenFrom(req, url));
export const authCookie = () => `${COOKIE}=${encodeURIComponent(TOKEN)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000`;
export const controlUrl = () => `http://localhost:${PORT}/control.html?token=${TOKEN}`;
// Trình duyệt ngay trên máy chạy tool (giống Sàn Quẩy): mở thẳng bảng điều khiển, tự cấp cookie — không bắt nhập mã.
// Máy khác trong mạng (chế độ điện thoại) chỉ xem được overlay, không mở được bảng điều khiển / gửi lệnh. Công cụ ngoài gọi /rpc vẫn dùng Bearer token.
export const isLoopback = req => /^(::1$|127\.|::ffff:127\.)/.test(req.socket.remoteAddress || '');
