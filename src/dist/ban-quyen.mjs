// ============================================================================
// PHÂN PHỐI — BẢN QUYỀN Thắp Sáng Bản Đồ: chép từ Sàn quẩy (dichua/games/san-quay/ban-quyen.js) qua Tiệc cưới,
//   mã sản phẩm riêng "thap-sang-ban-do" trên vn-tool.online (phải tạo sản phẩm này trên web).
//   - Kích hoạt: gửi key + mã máy lên vn-tool.online → nhận "giấy kích hoạt" (JWT ký RS256), lưu data/ban-quyen.json.
//   - App tự kiểm tra giấy bằng khoá công khai bên dưới (không cần mạng) để mở khoá kết nối LIVE.
//   - Tải ảnh / kiểm tra / tải bản mới: mọi yêu cầu đều gửi kèm giấy (Authorization: Bearer),
//     máy chủ kiểm tra lại key còn hạn + máy này còn trong danh sách mới trả tệp → không có link công khai.
//   - Mỗi lần kiểm tra, máy chủ trả giấy mới → lưu lại (giấy key vĩnh viễn chỉ ghi hạn 30 ngày).
// ============================================================================
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const PRODUCT = 'thap-sang-ban-do';
const API_BASE = (process.env.TSBD_LICENSE_URL || 'https://vn-tool.online').replace(/\/+$/, '');
// Khoá công khai của vn-tool.online (storage/app/keys/license_public.key trên web)
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu9d2H7fHsbi6mnnll2Kr
YpWHpglEQkCkCNskd/n5nhTZdzDd2WLlI5EjGKYo76Fk4IjWAzgN3Mtjsj9mag6y
+bBR+pKa4oMWTYKi9TkwMuiUC0Mq9rL6fk+wjwNmX0n4Qrh/bs3K3AI3/WunzIpw
Ccql0k7p3k0B2FOUJI3y3LoeVuh1aT5FkhRXskiYDxWhbiQfHxaGVsFpyu+uQ8l1
KeEb6l3/0iKqLb7DJdlqlxRRDVURU5W/ETRMlB7oYD9J+xAO8gk0TIbyXPB+GZqC
nunv0QNLDfpb2sgKPdnVzjcW2AV5iX3pWdH4gqWljwUzMoTPn37dHglz0jKdHz6f
SwIDAQAB
-----END PUBLIC KEY-----`;

// Máy chủ / Cloudflare / hosting đang bận hoặc tạm chặn IP → thử lại, KHÔNG coi là key hỏng
const BUSY = [429, 500, 502, 503, 504, 520, 521, 522, 523, 524];
// Chỉ những mã này (JSON do vn-tool trả) mới là key / máy thật sự bị từ chối → bỏ giấy kích hoạt
const AUTH_CODES = ['TOKEN_INVALID', 'KEY_INVALID', 'KEY_EXPIRED', 'DEVICE_REMOVED'];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const busyMsg = (status) =>
  `Máy chủ đang bận hoặc mạng của bạn đang bị giới hạn tạm thời (HTTP ${status}). Đợi 10–15 phút rồi thử lại; vẫn lỗi thì đổi mạng (vd. phát 4G từ điện thoại). Key không bị trừ lượt khi thử lại trên cùng máy.`;
// Cloudflare chặn / bắt thử thách IP (hay gặp khi bật VPN, proxy, 1.1.1.1 WARP): trả HTML thay vì JSON
function cfBlocked(r) {
  if (!r || !r.headers) return false;
  const h = (k) => String(r.headers.get(k) || '').toLowerCase();
  if (h('cf-mitigated') === 'challenge') return true;
  return [403, 429, 503].includes(r.status) && h('server') === 'cloudflare' && h('content-type').includes('text/html');
}
const VPN_MSG =
  'Mạng của bạn đang bị tường lửa của máy chủ chặn — thường do đang bật VPN / proxy / 1.1.1.1 (WARP). Hãy TẮT VPN rồi bấm thử lại (vẫn lỗi thì đổi mạng, vd. phát 4G từ điện thoại). Key và kích hoạt không bị ảnh hưởng.';
// fetch có thử lại khi máy chủ bận / mất mạng thoáng qua (chờ 4 giây rồi 10 giây)
async function fetchRetry(url, opts, timeout = 20000) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(timeout) });
      // Bị Cloudflare chặn thì thử lại cũng vô ích → trả ngay để báo tắt VPN
      if (!BUSY.includes(r.status) || i >= 2 || cfBlocked(r)) return r;
    } catch (e) {
      if (i >= 2) throw e;
    }
    await wait(i ? 10000 : 4000);
  }
}

const fromB64url = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

// Mã máy: MachineGuid của Windows băm kèm tên sản phẩm
function machineId() {
  let raw = '';
  if (process.platform === 'win32') {
    try {
      const out = execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], { windowsHide: true, encoding: 'utf8', timeout: 5000 });
      raw = (/MachineGuid\s+REG_SZ\s+([0-9a-f-]+)/i.exec(out) || [])[1] || '';
    } catch (_) {}
  }
  if (!raw) raw = `${os.hostname()}|${(os.cpus()[0] || {}).model || ''}|${os.totalmem()}`;
  return crypto.createHash('sha256').update(`${raw.toLowerCase()}|${PRODUCT}`).digest('base64url').slice(0, 32);
}

// bypass: chạy từ mã nguồn trên máy làm game thì không khoá kết nối LIVE (vẫn kích hoạt / tải ảnh được)
export function createLicense(dataDir, { bypass = false } = {}) {
  const file = path.join(dataDir, 'ban-quyen.json');
  const hwid = machineId();
  let cur = null; // { ok, email, keyTail }
  let curToken = '';
  let keyTail = '';

  // Hạn ghi trong giấy không xét ở đây: máy chủ kiểm tra lại key mỗi lần tải và cấp giấy mới
  function check(token) {
    try {
      const [h, b, s] = String(token || '').split('.');
      if (!h || !b || !s) return null;
      if (!crypto.verify('RSA-SHA256', Buffer.from(`${h}.${b}`), PUBLIC_KEY, fromB64url(s))) return null;
      const p = JSON.parse(fromB64url(b).toString('utf8'));
      if (p.typ !== 'activation' || p.p !== PRODUCT || p.h !== hwid) return null;
      return p;
    } catch (_) {
      return null;
    }
  }

  function save(token) {
    const p = check(token);
    if (!p) return false;
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ token, keyTail, savedAt: new Date().toISOString() }, null, 2));
    curToken = token;
    cur = { ok: true, email: p.e || '', keyTail };
    return true;
  }

  function load() {
    cur = null;
    curToken = '';
    try {
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
      keyTail = saved.keyTail || '';
      const p = check(saved.token);
      if (p) (cur = { ok: true, email: p.e || '', keyTail }), (curToken = saved.token);
    } catch (_) {}
  }
  load();

  async function call(method, route, timeout = 20000) {
    if (!curToken) return { ok: false, message: 'Chưa kích hoạt key trên máy này — nhập key ở đầu trang điều khiển (admin).' };
    let r;
    try {
      r = await fetchRetry(`${API_BASE}/api/app/${PRODUCT}/${route}`, { method, headers: { Authorization: `Bearer ${curToken}`, Accept: 'application/json' } }, timeout);
    } catch (e) {
      return { ok: false, busy: true, offline: true, message: `Không kết nối được máy chủ (cần Internet): ${e.cause?.code || e.message}` };
    }
    if (cfBlocked(r)) return { ok: false, busy: true, vpn: true, message: VPN_MSG };
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) {
      // Key bị thu hồi / máy bị gỡ (vn-tool trả mã rõ ràng) → bỏ giấy cũ, bắt nhập lại key.
      // 403 / 503 không kèm mã (Cloudflare, hosting chặn tạm) thì giữ nguyên kích hoạt.
      if ([401, 403].includes(r.status) && AUTH_CODES.includes(d.code)) {
        fs.rmSync(file, { force: true });
        load();
      }
      if (!d.code && (BUSY.includes(r.status) || r.status === 403)) return { ok: false, busy: true, message: busyMsg(r.status) };
      return { ok: false, code: d.code, message: d.message || `Máy chủ từ chối (HTTP ${r.status})` };
    }
    return d;
  }

  async function activate(rawKey) {
    const key = String(rawKey || '').trim().toUpperCase();
    if (!/^[A-Z0-9-]{8,64}$/.test(key)) return { ok: false, message: 'Key không đúng định dạng — dán đúng key trong email mua hàng.' };
    let r;
    let d = {};
    try {
      r = await fetchRetry(`${API_BASE}/api/license/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ product: PRODUCT, key, hwid, name: os.hostname().slice(0, 80) })
      });
      if (cfBlocked(r)) return { ok: false, vpn: true, message: VPN_MSG };
      d = await r.json().catch(() => ({}));
    } catch (e) {
      return { ok: false, message: `Không kết nối được máy chủ kích hoạt (cần Internet): ${e.message}` };
    }
    if (!r.ok || !d.ok) {
      if (!d.code && (BUSY.includes(r.status) || r.status === 403)) return { ok: false, message: busyMsg(r.status) };
      return { ok: false, message: d.message || `Kích hoạt lỗi (HTTP ${r.status})` };
    }
    keyTail = key.slice(-4);
    let saved = false;
    try {
      saved = save(d.token);
    } catch (e) {
      return { ok: false, message: `Không ghi được tệp kích hoạt vào thư mục tool (${e.code || e.message}). Giải nén tool ra Desktop hoặc ổ D (không để trong Program Files / trong tệp zip) rồi kích hoạt lại.` };
    }
    if (!saved) return { ok: false, message: 'Giấy kích hoạt nhận về không hợp lệ.' };
    return { ok: true, email: cur.email, devices: d.devices, maxDevices: d.max_devices };
  }

  // Hỏi phiên bản mới nhất (máy chủ kiểm tra key + cấp giấy mới)
  async function checkUpdate() {
    const d = await call('POST', 'check');
    if (!d.ok) return d;
    if (d.token) save(d.token);
    return { ok: true, version: d.version || '', notes: d.notes || '', size: d.size || 0, sha256: d.sha256 || '', assets: d.assets || 0 };
  }

  const assetList = () => call('GET', 'assets');
  // signal: truyền vào khi bên gọi tự canh "lâu không nhận được dữ liệu"; không có thì hết giờ sau timeout
  const authed = (route, timeout, headers = {}, signal = AbortSignal.timeout(timeout)) =>
    fetch(`${API_BASE}/api/app/${PRODUCT}/${route}`, { headers: { Authorization: `Bearer ${curToken}`, ...headers }, signal });
  // timeout lớn hơn cho tệp nặng (nhân vật 3D .vrm ~20 MB)
  const fetchFile = (name, timeout = 60000) => authed(`asset/${encodeURIComponent(name)}`, timeout);
  // from > 0: tải tiếp từ byte thứ from (Range) khi lần trước bị đứt giữa chừng
    const fetchPart = (name, from = 0, signal) => authed(`asset/${encodeURIComponent(name)}`, 0, from > 0 ? { Range: `bytes=${from}-` } : {}, signal);
  const fetchRelease = (from = 0, signal) => authed('release', 30 * 60 * 1000, from > 0 ? { Range: `bytes=${from}-` } : {}, signal);

  return {
    cfBlocked,
    VPN_MSG,
    get ok() {
      return bypass || !!(cur && cur.ok);
    },
    get activated() {
      return !!curToken;
    },
    status() {
      if (bypass && !cur) return { ok: true, dev: true };
      return cur ? { ...cur } : { ok: false };
    },
    activate,
    checkUpdate,
    assetList,
    fetchFile,
    fetchPart,
    fetchRelease,
    reload: load
  };
}

