// TẦNG 1 — API key EulerStream (dịch vụ ký kết nối TikTok LIVE), giống Sàn Quẩy / Quán Nhậu.
// Không có key: EulerStream giới hạn số lần kết nối mỗi giờ (dễ báo "rate limit"). Có key gói Free là hết giới hạn đó.
// Lưu ở data/app-config.json ("signApiKey"). Không bao giờ trả key ra ngoài — chỉ 4 ký tự cuối.
import { FILES, readJSON, writeJSON } from '../core/paths.mjs';

const KEY_RE = /^[A-Za-z0-9._\-=+/]{8,300}$/;
export const getSignKey = () => String(readJSON(FILES.config, {})?.signApiKey || '');
export const signView = () => { const k = getSignKey(); return { hasKey: !!k, tail: k ? k.slice(-4) : '' }; };

export function setSignKey(raw){
  const key = String(raw ?? '').trim();
  if (key && !KEY_RE.test(key)) throw new Error('Key không hợp lệ — sao chép lại nguyên key trên eulerstream.com (không có khoảng trắng).');
  const cur = readJSON(FILES.config, {}) || {};
  if (key) cur.signApiKey = key; else delete cur.signApiKey;
  writeJSON(FILES.config, cur, true);
  return signView();
}

// Thư viện giữ key ở biến dùng chung (cache + header X-Api-Key): dọn trước mỗi lần kết nối,
// không thì đổi / xóa key vẫn gửi key cũ tới khi tắt tool.
export function applySignKey(SignConfig, key){
  if (!SignConfig) return;
  SignConfig.apiKey = key || undefined;
  if (SignConfig.baseOptions?.headers) delete SignConfig.baseOptions.headers['X-Api-Key'];
  SignConfig.cachedInstance = undefined;
}
export const isBadKeyError = s => /status 401|API Key is invalid|từ chối API key/i.test(String(s || ''));
export const isRateLimit = s => /rate.?limit|too many|429/i.test(String(s || ''));
