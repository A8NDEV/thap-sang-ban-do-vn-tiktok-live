// TẦNG 2 — Bật / tắt "LIVE bằng điện thoại" ngay trên trang điều khiển (kinh nghiệm Quán Nhậu Chung /api/phone-mode):
//   đóng cổng rồi mở lại trên 0.0.0.0 (cả mạng Wi-Fi) hoặc 127.0.0.1 (chỉ máy này) — không cần tắt tool, không cần file .bat riêng.
//   Kết nối đang mở (OBS, trang điều khiển, WebSocket) vẫn giữ; chỉ kết nối mới theo địa chỉ mới.
//   Không mở được cổng mới (tường lửa / cổng bị chiếm) → quay về như cũ và báo lỗi.
//   Mở bằng CHAY-DIEN-THOAI.bat (TSBD_LAN=1) → luôn bật, không tắt được trên trang.
import { FILES, readJSON, writeJSON } from '../core/paths.mjs';
import { addLog } from '../core/bus.mjs';
import { setLan, lanIps } from './auth.mjs';
import { ensureFirewall } from './obs.mjs';

let S = null, PORT = 0, LOCAL = '127.0.0.1', LANHOST = '0.0.0.0', FIXED = false, lan = false, rebinding = false;
export function configurePhone({ server, port, localHost, lanHost, lanFixed, lanOn }){
  S = server; PORT = port; LOCAL = localHost; LANHOST = lanHost; FIXED = lanFixed; lan = lanOn;
}
export const isRebinding = () => rebinding;
export const phoneFixed = () => FIXED;

const logLinks = () => {
  const ips = lanIps();
  if (!ips.length) addLog('📱 Máy chưa kết nối Wi-Fi / mạng LAN — điện thoại sẽ không mở được.');
  for (const ip of ips) addLog(`📱 Điện thoại (cùng Wi-Fi): http://${ip}:${PORT}/overlay.html`);
};

export function setPhoneMode(on){
  on = !!on;
  if (FIXED && !on) return Promise.reject(new Error('Đang mở bằng CHAY-DIEN-THOAI.bat — tắt tool rồi mở bằng CHAY.bat để tắt chế độ điện thoại.'));
  if (rebinding) return Promise.reject(new Error('Đang đổi, thử lại sau giây lát'));
  const save = () => { const c = readJSON(FILES.config, {}) || {}; c.phoneLan = on; writeJSON(FILES.config, c, true); };
  if (on === lan) { save(); return Promise.resolve({ lan }); }
  rebinding = true;
  const host = on ? LANHOST : LOCAL, prevHost = lan ? LANHOST : LOCAL;
  return new Promise((resolve, reject) => {
    const back = e => {
      S.listen(PORT, prevHost, () => { rebinding = false; reject(new Error(`Không đổi được (${e.code || e.message}) — vẫn giữ chế độ cũ.`)); });
    };
    S.close();
    S.once('error', back);
    S.listen(PORT, host, () => {
      S.off('error', back);
      rebinding = false; lan = on; setLan(on); save();
      if (on) { logLinks(); ensureFirewall().catch(() => {}); }
      else addLog('📱 Đã tắt LIVE bằng điện thoại — chỉ máy này mở được màn hình bản đồ.');
      resolve({ lan });
    });
  });
}
