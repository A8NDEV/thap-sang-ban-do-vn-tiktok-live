// Hiệu ứng điện ảnh: B1 đèn lồng + tàn lửa bay lên khi tỉnh sáng lần đầu, B2 cảnh quà lớn.
// Chỉ animate transform + opacity (WAAPI). Mọi phần tử tự dọn đúng một lần, ngân sách nhả đúng một lần.
import { $ } from './util.js';
import { P } from './map.js';
import { isLite } from './theme.js';
import { qualityLevel } from './fx-perf.js';
import { giftTier, createBudget, LANTERN_MAX, lanternCount } from './fx-cinema-logic.js';

if (typeof document !== 'undefined' && !document.getElementById('fx-cinema-css')) {
  const link = document.createElement('link');
  link.id = 'fx-cinema-css';
  link.rel = 'stylesheet';
  link.href = new URL('../../css/fx-cinema.css', import.meta.url).href;
  document.head?.appendChild(link);
}

const lanternBudget = createBudget(LANTERN_MAX);
const sceneBudget = createBudget(1);

const rnd = (a, b) => a + Math.random() * (b - a);
const clip = (s) => Array.from(String(s ?? '')).slice(0, 40).join('');

// Chạy animation và gọi done() đúng một lần: khi finished/cancel hoặc khi hết hạn dự phòng.
function runOnce(el, keyframes, opts, done) {
  let over = false;
  const end = () => { if (over) return; over = true; done(); };
  const total = (opts.delay || 0) + opts.duration + 400;
  setTimeout(end, total);
  try {
    const a = el.animate(keyframes, { fill: 'both', ...opts });
    a.finished.then(end, end);
  } catch { end(); }
}

function spawn(cls, left, top, keyframes, opts, container) {
  if (!lanternBudget.tryAcquire()) return false;
  let el = null;
  try {
    el = document.createElement(cls === 'cn-lantern' ? 'div' : 'i');
    el.className = cls;
    el.style.left = left + 'px';
    el.style.top = top + 'px';
    container.appendChild(el);
    runOnce(el, keyframes, opts, () => { el.remove(); lanternBudget.release(); });
    return true;
  } catch {
    el?.remove();
    lanternBudget.release();
    return false;
  }
}

// B1: đèn lồng giấy đỏ + tàn lửa vàng bay lên từ tỉnh vừa sáng lần đầu.
export function lanternRise(prov) {
  try {
    if (isLite()) return;
    if (!P || !Object.hasOwn(P, prov)) return;
    const v = P[prov];
    if (!v || !Number.isFinite(v.cx) || !Number.isFinite(v.cy)) return;
    const n = lanternCount(qualityLevel(), true);
    if (n === 0) return;
    const marks = $('#marks');
    if (!marks) return;

    for (let i = 0; i < n; i++) {
      const dur = rnd(2800, 3800);
      const rise = rnd(160, 280);
      const sway = rnd(8, 14);
      const dir = i % 2 ? 1 : -1;
      const x0 = rnd(-26, 26);
      const k = (p, x, y, o, s, r) => ({ offset: p, opacity: o, transform: `translate3d(${x0 + x}px, ${-y}px, 0) rotate(${r}deg) scale(${s})` });
      const ok = spawn('cn-lantern', v.cx, v.cy, [
        k(0, 0, 0, 0, 0.6, 0),
        k(0.12, dir * sway * 0.3, rise * 0.15, 1, 0.9, dir * 3),
        k(0.38, -dir * sway, rise * 0.45, 1, 1, -dir * 4),
        k(0.68, dir * sway, rise * 0.78, 0.9, 1, dir * 4),
        k(1, -dir * sway * 0.4, rise, 0, 1.05, 0),
      ], { duration: dur, delay: i * 140, easing: 'ease-out' }, marks);
      if (!ok) return;
    }
    for (let i = 0; i < n * 2; i++) {
      const dur = rnd(2400, 3400);
      const rise = rnd(110, 240);
      const x0 = rnd(-30, 30);
      const dx = rnd(-18, 18);
      spawn('cn-ember', v.cx, v.cy, [
        { transform: `translate3d(${x0}px, 0, 0) scale(1)`, opacity: 0 },
        { offset: 0.15, opacity: 1 },
        { transform: `translate3d(${x0 + dx}px, ${-rise}px, 0) scale(.3)`, opacity: 0 },
      ], { duration: dur, delay: rnd(0, 500), easing: 'ease-out' }, marks);
    }
  } catch { /* hiệu ứng phụ: không bao giờ làm hỏng luồng chính */ }
}

// B2: cảnh điện ảnh khi có quà lớn. Tối đa một cảnh cùng lúc, quà tới khi đang chiếu thì bỏ qua.
export function bigGiftCinema(ev) {
  try {
    if (!ev) return;
    const tier = giftTier(ev.coins);
    if (tier < 2) return;
    if (isLite()) return;
    const stage = $('#stage');
    if (!stage) return;
    if (!sceneBudget.tryAcquire()) return;

    const dur = tier === 3 ? 4800 : 3200;
    const els = [];
    let over = false;
    const finish = () => {
      if (over) return;
      over = true;
      for (const e of els) e.remove();
      sceneBudget.release();
    };
    try {
    setTimeout(finish, dur + 600);
    const q = qualityLevel();
    const add = (el) => { els.push(el); stage.appendChild(el); return el; };
    const anims = [];
    const play = (el, kf, opts) => {
      try { anims.push(el.animate(kf, { duration: dur, fill: 'both', ...opts }).finished); } catch { /* bỏ qua */ }
    };
    const slideIn = 420 / dur, slideOut = 1 - 520 / dur;
    const bar = (cls, from) => {
      const el = add(Object.assign(document.createElement('div'), { className: 'cn-bar ' + cls }));
      play(el, [
        { transform: `translateY(${from})`, easing: 'cubic-bezier(.2,.8,.2,1)' },
        { offset: slideIn, transform: 'translateY(0)' },
        { offset: slideOut, transform: 'translateY(0)', easing: 'ease-in' },
        { transform: `translateY(${from})` },
      ], {});
    };
    bar('top', '-100%');
    bar('bot', '100%');

    if (q < 2) {
      const rays = add(Object.assign(document.createElement('div'), { className: 'cn-rays' }));
      const peak = tier === 3 ? 0.35 : 0.26;
      play(rays, [
        { transform: 'rotate(0deg)', opacity: 0 },
        { offset: 0.2, opacity: peak },
        { offset: 0.8, opacity: peak },
        { transform: `rotate(${dur * 0.036}deg)`, opacity: 0 },
      ], { easing: 'linear' });
    }

    const title = add(Object.assign(document.createElement('div'), { className: 'cn-title' + (tier === 3 ? ' t3' : '') }));
    const l1 = document.createElement('div');
    l1.className = 'cn-name';
    l1.textContent = clip(ev.name);
    const l2 = document.createElement('div');
    l2.className = 'cn-gift';
    l2.textContent = `${clip(ev.gift)} · ${Number(ev.coins).toLocaleString('vi-VN')} xu`;
    title.append(l1, l2);
    play(title, [
      { transform: 'translate3d(0,0,0) scale(.9)', opacity: 0, easing: 'cubic-bezier(.2,.9,.3,1)' },
      { offset: 0.14, transform: 'translate3d(0,0,0) scale(1)', opacity: 1, easing: 'linear' },
      { offset: 0.84, transform: 'translate3d(0,0,0) scale(1.04)', opacity: 1, easing: 'ease-in' },
      { transform: 'translate3d(0,0,0) scale(1.07)', opacity: 0 },
    ], {});

    Promise.allSettled(anims).then(finish);
    } catch { finish(); }
  } catch { /* hiệu ứng phụ: không bao giờ làm hỏng luồng chính */ }
}
