// PHÂN PHỐI — lắp ráp bản quyền + tải dữ liệu từ máy chủ (vn-tool.online, sản phẩm thap-sang-ban-do).
// ĐÃ GỠ bộ tự cập nhật (cap-nhat.mjs): nó chép đè toàn bộ mã nguồn nên sẽ làm mất phần bạn tự sửa.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, DATA_DIR, CACHE_DIR, MUSIC_DIR } from '../core/paths.mjs';
import { broadcast } from '../core/bus.mjs';
import { license } from './license.mjs';
import { createDataSync } from './tai-du-lieu.mjs';
import { pushMusic } from '../audio/music.mjs';
import { styles } from './giao-dien.mjs';

const readVersion = root => { try { return JSON.parse(fs.readFileSync(path.join(root, 'phien-ban.json'), 'utf8')).version || ''; } catch { return ''; } };
export const APP_VERSION = readVersion(ROOT);
export const dataSync = createDataSync({ dataDir: DATA_DIR, cacheDir: CACHE_DIR, musicDir: MUSIC_DIR, license, onChange: () => { pushMusic(); pushDist(); } });
export const distMsg = () => ({ t: 'dist', version: APP_VERSION, data: dataSync.status(), activated: license.activated, styles: styles.list() });
export const pushDist = () => broadcast(distMsg(), 'control');

// đã kích hoạt → 3 giây sau khi mở tool tự tải dữ liệu còn thiếu; tiến trình đẩy về trang điều khiển mỗi 2 giây khi đang chạy
export function startDist(){
  if (license.activated) setTimeout(() => dataSync.sync(), 3000).unref();
  setInterval(() => { if (['list', 'download', 'wait'].includes(dataSync.status().stage)) pushDist(); }, 2000).unref();
}
