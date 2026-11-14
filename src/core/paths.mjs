// Đường dẫn dùng chung. APP_HOME (biến môi trường) cho phép bản Electron đóng gói ghi dữ liệu vào thư mục người dùng.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const APP_HOME = process.env.APP_HOME ? path.resolve(process.env.APP_HOME) : ROOT;
export const PUBLIC_DIR = path.join(ROOT, 'public');
export const DATA_DIR = path.join(APP_HOME, 'data');
export const MUSIC_DIR = path.join(APP_HOME, 'nhac');
export const TTS_DIR = path.join(DATA_DIR, 'tts');
export const CACHE_DIR = path.join(DATA_DIR, 'tts_cache');

export const FILES = {
  config: path.join(DATA_DIR, 'app-config.json'),
  state: path.join(DATA_DIR, 'state.json'),
  fans: path.join(DATA_DIR, 'fans.json'),
  owners: path.join(DATA_DIR, 'owners.json'),
  prices: path.join(DATA_DIR, 'gift_prices.json'),
  runtime: path.join(DATA_DIR, 'runtime.json'),
};

for (const d of [DATA_DIR, MUSIC_DIR, TTS_DIR, CACHE_DIR]) fs.mkdirSync(d, { recursive: true });

// Bản cũ (một file server.mjs) lưu dữ liệu ở thư mục gốc → chuyển sang data/ một lần
for (const [old, now] of [['state.json', FILES.state], ['fans.json', FILES.fans], ['gift_prices.json', FILES.prices]]) {
  const from = path.join(APP_HOME, old);
  try { if (fs.existsSync(from) && !fs.existsSync(now)) fs.renameSync(from, now); } catch {}
}
for (const old of ['tts', 'tts_cache']) {
  const from = path.join(APP_HOME, old), to = old === 'tts' ? TTS_DIR : CACHE_DIR;
  try { if (fs.existsSync(from) && fs.readdirSync(to).length === 0) { fs.rmSync(to, { recursive: true, force: true }); fs.renameSync(from, to); } } catch {}
}

export const readJSON = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')) ?? fallback; } catch { return fallback; } };
// ghi an toàn: ghi file tạm rồi đổi tên, tránh hỏng file khi tắt máy giữa chừng
export function writeJSON(file, data, pretty = false){
  const tmp = file + '.tmp', s = JSON.stringify(data, null, pretty ? 2 : 0);
  fs.writeFileSync(tmp, s);
  try { fs.renameSync(tmp, file); } catch { fs.writeFileSync(file, s); try { fs.unlinkSync(tmp); } catch {} }   // Windows: file đang bị khóa (antivirus) → ghi thẳng
}
