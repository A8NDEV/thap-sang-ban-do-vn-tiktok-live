// Camera "zoom nhẹ mượt": không dùng CSS transition, tự làm mượt bằng một vòng rAF duy nhất.
// Import an toàn trong Node: không đụng DOM/rAF ở mức module.
import { springStep, isSpringSettled, SOFT_OMEGA, PAN_FRACTION } from './fx-camera-logic.js';

let soft = false;
let el = null;
let raf = 0;
let last = 0;
let cur = { x: 0, y: 0, s: 1 };
let vel = { x: 0, y: 0, s: 0 };   // vận tốc: giữ liên tục khi đổi đích (không giật)
let tgt = { x: 0, y: 0, s: 1 };

export const isSoftZoom = () => soft;

function stop() {
  if (raf) { try { cancelAnimationFrame(raf); } catch { /* bỏ qua */ } }
  raf = 0;
  last = 0;
}

function write() {
  if (el) el.style.transform = `translate3d(${cur.x.toFixed(2)}px,${cur.y.toFixed(2)}px,0) scale(${cur.s.toFixed(4)})`;
}

function frame(t) {
  raf = 0;
  if (!soft || !el) { last = 0; return; }
  const dt = last ? Math.min(100, t - last) : 16.7;
  last = t;
  const ax = springStep(cur.x, vel.x, tgt.x, dt, SOFT_OMEGA);
  const ay = springStep(cur.y, vel.y, tgt.y, dt, SOFT_OMEGA);
  const as = springStep(cur.s, vel.s, tgt.s, dt, SOFT_OMEGA);
  cur = { x: ax.x, y: ay.x, s: as.x };
  vel = { x: ax.v, y: ay.v, s: as.v };
  if (isSpringSettled(tgt.x - cur.x, tgt.y - cur.y, tgt.s - cur.s, vel.x, vel.y, vel.s)) {
    cur = { ...tgt };
    vel = { x: 0, y: 0, s: 0 };
    write();
    last = 0;
    return;
  }
  write();
  raf = requestAnimationFrame(frame);
}

// Đọc vị trí hiện tại từ transform inline (nếu có) để không giật khi bật chế độ giữa chừng.
function readCurrent(camEl) {
  const m = /translate3d\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px.*?scale\(\s*([\d.]+)/.exec(camEl.style.transform || '');
  return m ? { x: +m[1], y: +m[2], s: +m[3] } : { x: 0, y: 0, s: 1 };
}

export function setSoftZoom(on) {
  on = !!on;
  if (on === soft) return;
  soft = on;
  if (!on) {
    stop();
    if (el) el.style.transition = '';
    el = null; // lần bật lại sẽ đọc lại transform hiện tại
  } else if (el) {
    el.style.transition = 'none';
  }
}

export function softApply(camEl, tx, ty, k) {
  if (!camEl || !soft) return;
  if (camEl !== el) {
    stop();
    el = camEl;
    cur = readCurrent(camEl);
    vel = { x: 0, y: 0, s: 0 };
  }
  el.style.transition = 'none';
  // Zoom nhẹ chỉ dịch một phần quãng đường tới tỉnh (PAN_FRACTION): tỉnh phía nam từng kéo cả bản đồ dịch ~400px.
  const kk = Number.isFinite(k) && k > 0 ? k : 1;
  const pan = kk > 1.02 ? PAN_FRACTION : 1;
  tgt = { x: Number.isFinite(tx) ? tx * pan : 0, y: Number.isFinite(ty) ? ty * pan : 0, s: kk };
  if (!raf) raf = requestAnimationFrame(frame);
}
