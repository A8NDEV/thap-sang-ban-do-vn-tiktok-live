// PHÂN PHỐI — lắp ráp bản quyền + cập nhật bản mới + tải dữ liệu từ máy chủ (vn-tool.online, sản phẩm thap-sang-ban-do).
import { ROOT, DATA_DIR, CACHE_DIR, MUSIC_DIR } from '../core/paths.mjs';
import { broadcast, addLog, requestShutdown } from '../core/bus.mjs';
import { license, isDevMachine } from './license.mjs';
import { createUpdater, readVersion } from './cap-nhat.mjs';
import { createDataSync } from './tai-du-lieu.mjs';
import { pushMusic } from '../audio/music.mjs';
import { styles } from './giao-dien.mjs';

export const APP_VERSION = readVersion(ROOT);
export const updater = createUpdater({ appDir: ROOT, version: APP_VERSION, license, devMachine: isDevMachine, onRestart: () => { addLog('🔄 Đã cập nhật — đang khởi động lại…'); requestShutdown(); } });
export const dataSync = createDataSync({ dataDir: DATA_DIR, cacheDir: CACHE_DIR, musicDir: MUSIC_DIR, license, onChange: () => { pushMusic(); pushDist(); } });
export const distMsg = () => ({ t: 'dist', version: APP_VERSION, update: updater.status(), data: dataSync.status(), activated: license.activated, styles: styles.list() });
export const pushDist = () => broadcast(distMsg(), 'control');

// đã kích hoạt → 3 giây sau khi mở tool tự tải dữ liệu còn thiếu; tiến trình đẩy về trang điều khiển mỗi 2 giây khi đang chạy
export function startDist(){
  if (license.activated) setTimeout(() => dataSync.sync(), 3000).unref();
  setInterval(() => { const u = updater.status().stage, d = dataSync.status().stage; if (!['idle', 'done', 'error'].includes(u) || ['list', 'download', 'wait'].includes(d)) pushDist(); }, 2000).unref();
}
