// Tên chữ lớn: khi một tỉnh sáng lần đầu, tên người thắp hiện từng chữ phía trên tỉnh, giữ một lúc rồi bay lên mờ dần như tàn lửa.
// Chỉ animate transform + opacity (WAAPI). Một cảnh một lúc (cảnh mới trong lúc đang chiếu bị bỏ). Tên đặt bằng textContent.
// Phần tử dọn đúng một lần, ngân sách nhả đúng một lần.
import { $ } from './util.js';
import { P } from './map.js';
import { isLite } from './theme.js';
import { qualityLevel } from './fx-perf.js';
import { stagePt } from './theme-fx.js';
import { createBudget } from './fx-cinema-logic.js';

if (typeof document !== 'undefined' && !document.getElementById('fx-names-css')) {
  const link = document.createElement('link');
  link.id = 'fx-names-css';
  link.rel = 'stylesheet';
  link.href = new URL('../../css/fx-names.css', import.meta.url).href;
  document.head?.appendChild(link);
}

const MAX_CHARS = 22, STAGGER = 40, IN = 360, HOLD = 1400, OUT = 900;
const X_MIN = 24, X_MAX = 736, Y_MIN = 240;   // X_MAX 736: không tràn sang cột thẻ bên phải (cột thẻ bắt đầu ở x = 744)
const sceneBudget = createBudget(1);
const rnd = (a, b) => a + Math.random() * (b - a);

export function showNameBurst({ name, prov } = {}) {
  let released = false, box = null, timer = 0;
  const finish = () => {
    if (released) return;
    released = true;
    clearTimeout(timer);
    try { box?.remove(); } catch { /* bỏ qua */ }
    sceneBudget.release();
  };
  let acquired = false;
  try {
    if (isLite() || qualityLevel() >= 2) return;
    if (!P || !Object.hasOwn(P, prov)) return;
    const letters = Array.from(String(name ?? '').replace(/\s+/g, ' ').trim()).slice(0, MAX_CHARS);
    if (!letters.length) return;
    const stage = $('#stage');
    if (!stage || typeof stage.animate !== 'function') return;
    if (!sceneBudget.tryAcquire()) return;
    acquired = true;

    let cx = P[prov].cx, cy = P[prov].cy;
    try { const pt = stagePt(prov); if (pt && Number.isFinite(pt.x) && Number.isFinite(pt.y)) { cx = pt.x; cy = pt.y; } } catch { /* dùng tọa độ bản đồ */ }

    box = document.createElement('div');
    box.className = 'nm-burst';
    const spans = letters.map(ch => { const s = document.createElement('span'); s.textContent = ch; box.appendChild(s); return s; });
    stage.appendChild(box);

    // kẹp vị trí để khung chữ nằm trong 24..736 ngang và không cao quá y = 240
    const w = box.offsetWidth || 0, h = box.offsetHeight || 0;
    const left = Math.min(Math.max(cx - w / 2, X_MIN), Math.max(X_MIN, X_MAX - w));
    const top = Math.max(cy - 70 - h / 2, Y_MIN);
    box.style.left = Math.round(left) + 'px';
    box.style.top = Math.round(top) + 'px';

    const D = IN + HOLD + OUT;
    const total = (spans.length - 1) * STAGGER + D;
    timer = setTimeout(finish, total + 500);
    const anims = [];
    spans.forEach((s, i) => {
      const dx = rnd(-22, 22), rise = rnd(60, 110);
      try {
        anims.push(s.animate([
          { transform: 'translate3d(0, 16px, 0) scale(.6)', opacity: 0, offset: 0, easing: 'cubic-bezier(.2,.9,.3,1.2)' },
          { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1, offset: IN / D },
          { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1, offset: (IN + HOLD) / D, easing: 'ease-in' },
          { transform: `translate3d(${dx}px, ${-rise}px, 0) scale(.5)`, opacity: 0, offset: 1 },
        ], { delay: i * STAGGER, duration: D, fill: 'both' }).finished);
      } catch { /* bỏ qua */ }
    });
    Promise.allSettled(anims).then(finish);
  } catch {
    if (acquired) finish();
    else { try { box?.remove(); } catch { /* bỏ qua */ } }
  }
}
