// Hoa theo miền khi một tỉnh sáng lần đầu: Bắc = cánh hoa đào rơi, Trung = vệt gió + cát vàng, Nam = hoa sen nở.
// Miền lấy theo P[prov].cy (< 700 Bắc, < 1250 Trung, còn lại Nam): public/data/tinh.js không có trường miền.
// Chỉ animate transform + opacity (WAAPI). Trần 24 phần tử, một cảnh một lúc (cảnh mới trong lúc đang chiếu bị bỏ).
// Bỏ qua khi isLite() hoặc qualityLevel() >= 1. Phần tử dọn đúng một lần, ngân sách nhả đúng một lần. Không rAF.
import { $ } from './util.js';
import { P } from './map.js';
import { isLite } from './theme.js';
import { qualityLevel } from './fx-perf.js';
import { stagePt } from './theme-fx.js';
import { createBudget } from './fx-cinema-logic.js';

if (typeof document !== 'undefined' && !document.getElementById('fx-region-css')) {
  const link = document.createElement('link');
  link.id = 'fx-region-css';
  link.rel = 'stylesheet';
  link.href = new URL('../../css/fx-region.css', import.meta.url).href;
  document.head?.appendChild(link);
}

const sceneBudget = createBudget(1);
const elBudget = createBudget(24);
const rnd = (a, b) => a + Math.random() * (b - a);

export function regionOf(cy) {
  return cy < 700 ? 'north' : cy < 1250 ? 'central' : 'south';
}

export function regionBloom(prov) {
  let box = null, timer = 0, released = false, n = 0, gotScene = false;
  const anims = [], ends = [];
  const finish = () => {
    if (released) return;
    released = true;
    clearTimeout(timer);
    for (const a of anims) { try { a.cancel(); } catch { /* bỏ qua */ } }
    try { box?.remove(); } catch { /* bỏ qua */ }
    if (n) elBudget.release(n);
    if (gotScene) sceneBudget.release();
  };
  const add = (cls, frames, opts) => {
    const el = document.createElement('i');
    el.className = cls;
    box.appendChild(el);
    const a = el.animate(frames, { fill: 'both', ...opts });
    anims.push(a);
    ends.push(opts.delay + opts.duration);
    return el;
  };
  try {
    if (isLite() || qualityLevel() >= 1) return;
    if (!P || !Object.hasOwn(P, prov)) return;
    const stage = $('#stage');
    if (!stage || typeof stage.animate !== 'function') return;
    let px = P[prov].cx, py = P[prov].cy;
    try { const pt = stagePt(prov); if (pt && Number.isFinite(pt.x) && Number.isFinite(pt.y)) { px = pt.x; py = pt.y; } } catch { /* dùng tọa độ bản đồ */ }
    if (!Number.isFinite(px) || !Number.isFinite(py)) return;
    const region = regionOf(P[prov].cy);
    const count = region === 'north' ? 10 : region === 'central' ? 9 : 18;
    if (!sceneBudget.tryAcquire()) return;
    gotScene = true;
    if (!elBudget.tryAcquire(count)) { finish(); return; }
    n = count;

    box = document.createElement('div');
    box.className = 'rg-box';
    stage.appendChild(box);

    if (region === 'north') {
      for (let i = 0; i < 10; i++) {
        const x = px + rnd(-70, 70), y = py - rnd(110, 190), dur = rnd(2800, 4000), dx = rnd(-50, 50), dy = rnd(150, 240), rot = rnd(180, 420) * (Math.random() < .5 ? -1 : 1), r0 = rnd(0, 360);
        add('rg-petal', [
          { transform: `translate3d(${x}px, ${y}px, 0) rotate(${r0}deg)`, opacity: 0, offset: 0 },
          { transform: `translate3d(${x + dx * .3}px, ${y + dy * .15}px, 0) rotate(${r0 + rot * .15}deg)`, opacity: 0.95, offset: 0.15 },
          { transform: `translate3d(${x + dx}px, ${y + dy}px, 0) rotate(${r0 + rot}deg)`, opacity: 0, offset: 1 },
        ], { delay: i * 160, duration: dur, easing: 'ease-in-out' });
      }
    } else if (region === 'central') {
      for (let i = 0; i < 3; i++) {
        const y = py + (i - 1) * 34 + rnd(-8, 8), x0 = px - 300;
        add('rg-wind', [
          { transform: `translate3d(${x0}px, ${y}px, 0) scale(.8)`, opacity: 0, offset: 0 },
          { transform: `translate3d(${x0 + 260}px, ${y - 6}px, 0) scale(1)`, opacity: 0.85, offset: 0.45 },
          { transform: `translate3d(${x0 + 560}px, ${y + 4}px, 0) scale(1.05)`, opacity: 0, offset: 1 },
        ], { delay: i * 260, duration: 1900, easing: 'ease-in-out' });
      }
      for (let i = 0; i < 6; i++) {
        const y = py + rnd(-60, 60), x0 = px - rnd(220, 300), w = rnd(-18, 18);
        add('rg-sand', [
          { transform: `translate3d(${x0}px, ${y}px, 0)`, opacity: 0, offset: 0 },
          { transform: `translate3d(${x0 + 280}px, ${y + w}px, 0)`, opacity: 0.9, offset: 0.5 },
          { transform: `translate3d(${x0 + 560}px, ${y - w}px, 0)`, opacity: 0, offset: 1 },
        ], { delay: 150 + i * 170, duration: rnd(1700, 2300), easing: 'ease-in-out' });
      }
    } else {
      // 3 lớp cánh: ngoài 8 cánh, giữa 6, trong 4; nở dần từ ngoài vào trong
      const layers = [[8, 'rg-lotus', 62, 1.0], [6, 'rg-lotus l2', 38, 0.8], [4, 'rg-lotus l3', 16, 0.6]];
      layers.forEach(([cnt, cls, spread, sc], li) => {
        for (let i = 0; i < cnt; i++) {
          const ang = (cnt === 1 ? 0 : (i / (cnt - 1) - 0.5) * 2) * spread * (li === 0 ? 1.45 : 1.2);
          add(cls, [
            { transform: `translate3d(${px}px, ${py}px, 0) rotate(${ang * .4}deg) scale(0)`, opacity: 0, offset: 0 },
            { transform: `translate3d(${px}px, ${py}px, 0) rotate(${ang}deg) scale(${sc})`, opacity: 0.95, offset: 0.45 },
            { transform: `translate3d(${px}px, ${py}px, 0) rotate(${ang}deg) scale(${sc})`, opacity: 0.95, offset: 0.75 },
            { transform: `translate3d(${px}px, ${py - 10}px, 0) rotate(${ang}deg) scale(${sc * 1.08})`, opacity: 0, offset: 1 },
          ], { delay: li * 260 + i * 25, duration: 2600, easing: 'ease-out' });
        }
      });
    }

    timer = setTimeout(finish, Math.max(...ends) + 600);
    Promise.allSettled(anims.map(a => a.finished)).then(finish);
  } catch {
    finish();
  }
}
