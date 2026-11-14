// Kênh nội bộ giữa các tầng: domain/audio chỉ gọi broadcast()/addLog(), không cần biết WebSocket.
// Tầng protocol (ws-hub) đăng ký nơi nhận qua setBroadcaster().
let sink = () => {};
export function setBroadcaster(fn){ sink = fn; }
// msg dạng { t: 'light', ... } → gửi tới overlay/control dưới dạng thông báo JSON-RPC 2.0 "map.<t>"
export function broadcast(msg, role){ sink(msg, role); }

export const log = [];
export function addLog(s){
  const line = `[${new Date().toLocaleTimeString('vi-VN')}] ${s}`;
  log.push(line); if (log.length > 300) log.shift();
  broadcast({ t: 'log', line }, 'control');
  console.log(line);
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, Math.round(+v || 0)));
// tắt server an toàn (ghi đĩa xong mới thoát) — server.mjs đăng ký; bộ cập nhật gọi sau khi chép bản mới (CHAY.bat tự chạy lại)
// mã thoát 77 = tắt hẳn (CHAY.bat thấy mã này thì đóng cửa sổ, không tự chạy lại)
export const QUIT_CODE = 77;
let shutdownFn = code => process.exit(code);
export function setShutdown(fn){ shutdownFn = fn; }
export const requestShutdown = () => shutdownFn(0);
export const requestQuit = () => shutdownFn(QUIT_CODE);
