// Camera "zoom nhẹ mượt": không dùng CSS transition, tự làm mượt bằng một vòng rAF duy nhất.
// Import an toàn trong Node: không đụng DOM/rAF ở mức module.
import { smoothStep, isSettled, SOFT_HALF_LIFE_MS } from './fx-camera-logic.js';

let soft = false;
let el = null;
let raf = 0;
let last = 0;
let cur = { x: 0, y: 0, s: 1 };
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
  cur.x = smoothStep(cur.x, tgt.x, dt, SOFT_HALF_LIFE_MS);
  cur.y = smoothStep(cur.y, tgt.y, dt, SOFT_HALF_LIFE_MS);
  cur.s = smoothStep(cur.s, tgt.s, dt, SOFT_HALF_LIFE_MS);
  if (isSettled(tgt.x - cur.x, tgt.y - cur.y, tgt.s - cur.s)) {
    cur = { ...tgt };
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
  }
  el.style.transition = 'none';
  tgt = { x: Number.isFinite(tx) ? tx : 0, y: Number.isFinite(ty) ? ty : 0, s: Number.isFinite(k) && k > 0 ? k : 1 };
  if (!raf) raf = requestAnimationFrame(frame);
}
