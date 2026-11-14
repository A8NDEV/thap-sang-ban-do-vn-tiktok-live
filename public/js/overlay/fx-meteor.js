// Quà từ 100 xu: mưa sao băng vàng hội tụ vào tỉnh, rồi nở các vòng hoa văn trống đồng + tia sáng.
// Thay cho con rồng emoji cũ. Chỉ animate transform + opacity (WAAPI); mọi phần tử tự dọn đúng một lần,
// ngân sách (một cảnh một lúc) nhả đúng một lần.
import { $ } from './util.js';
import { isLite } from './theme.js';
import { qualityLevel } from './fx-perf.js';
import { stagePt } from './theme-fx.js';
import { createBudget } from './fx-cinema-logic.js';
import { launchFirework, screenShake } from './particles.js';

if (typeof document !== 'undefined' && !document.getElementById('fx-meteor-css')) {
  const link = document.createElement('link');
  link.id = 'fx-meteor-css';
  link.rel = 'stylesheet';
  link.href = new URL('../../css/fx-meteor.css', import.meta.url).href;
  document.head?.appendChild(link);
}

const sceneBudget = createBudget(1);
const rnd = (a, b) => a + Math.random() * (b - a);

export function goldMeteors(prov, coins) {
  let released = false;
  const release = () => { if (released) return; released = true; sceneBudget.release(); };
  try {
    if (isLite()) return;
    const stage = $('#stage');
    if (!stage || typeof stage.animate !== 'function') return;
    if (!sceneBudget.tryAcquire()) return;

    let pt = null;
    try { pt = prov ? stagePt(prov) : null; } catch { pt = null; }
    const tx = pt && Number.isFinite(pt.x) ? pt.x : 540;
    const ty = pt && Number.isFinite(pt.y) ? pt.y : 880;

    const q = qualityLevel();
    const big = Number(coins) >= 1000;
    const n = q >= 2 ? 4 : big ? 14 : 8;
    let pending = 0;
    const timers = [];
    const done = (el) => () => {
      try { el.remove(); } catch { /* bỏ qua */ }
      pending -= 1;
      if (pending <= 0) release();
    };
    const play = (el, frames, opts) => {
      pending += 1;
      const end = done(el);
      let over = false;
      const once = () => { if (over) return; over = true; end(); };
      timers.push(setTimeout(once, (opts.delay || 0) + opts.duration + 500));
      try {
        const a = el.animate(frames, { fill: 'both', ...opts });
        a.finished.then(once, once);
      } catch { once(); }
    };
    timers.push(setTimeout(release, 6000));   // chốt an toàn: không bao giờ giữ ngân sách quá 6 giây

    let finaleAt = 0;
    for (let i = 0; i < n; i++) {
      const sx = rnd(60, 1020), sy = rnd(-140, 30);
      const ex = tx + rnd(-16, 16), ey = ty + rnd(-16, 16);
      const ang = Math.atan2(ey - sy, ex - sx);
      const delay = i * 65 + rnd(0, 40), dur = rnd(650, 950);
      finaleAt = Math.max(finaleAt, delay + dur);
      const el = document.createElement('div');
      el.className = 'mt';
      el.style.setProperty('--len', Math.round(rnd(160, 260)) + 'px');
      el.innerHTML = '<i class="mt-tail"></i><i class="mt-head"></i>';
      stage.appendChild(el);
      play(el, [
        { transform: `translate(${sx}px, ${sy}px) rotate(${ang}rad)`, opacity: 0, offset: 0 },
        { opacity: 1, offset: 0.12 },
        { transform: `translate(${ex}px, ${ey}px) rotate(${ang}rad)`, opacity: 1, offset: 0.93 },
        { transform: `translate(${ex}px, ${ey}px) rotate(${ang}rad)`, opacity: 0, offset: 1 },
      ], { delay, duration: dur, easing: 'cubic-bezier(.5,0,.9,.6)' });
      if (q < 1 && i % 2 === 0) timers.push(setTimeout(() => { try { launchFirework(ex, ey, 'gold', 14, 7); } catch { /* bỏ qua */ } }, delay + dur));
    }

    // cao trào: tia sáng chữ thập + 3 vòng trống đồng nở ra
    const star = document.createElement('div');
    star.className = 'mt-star';
    stage.appendChild(star);
    play(star, [
      { transform: `translate(${tx}px, ${ty}px) scale(.3)`, opacity: 0, offset: 0 },
      { transform: `translate(${tx}px, ${ty}px) scale(1.6)`, opacity: 1, offset: 0.35 },
      { transform: `translate(${tx}px, ${ty}px) scale(2.1)`, opacity: 0, offset: 1 },
    ], { delay: finaleAt, duration: 750, easing: 'ease-out' });
    for (let j = 0; j < 3; j++) {
      const ring = document.createElement('div');
      ring.className = 'mt-ring';
      stage.appendChild(ring);
      play(ring, [
        { transform: `translate(${tx}px, ${ty}px) scale(.2)`, opacity: 0, offset: 0 },   // ẩn trong lúc chờ tới cao trào (fill: 'both' giữ khung đầu)
        { transform: `translate(${tx}px, ${ty}px) scale(.45)`, opacity: 0.95, offset: 0.06 },
        { transform: `translate(${tx}px, ${ty}px) scale(${big ? 4 : 3.2})`, opacity: 0, offset: 1 },
      ], { delay: finaleAt + j * 150, duration: 1100, easing: 'cubic-bezier(.2,.7,.3,1)' });
    }
    timers.push(setTimeout(() => { try { screenShake('sm'); } catch { /* bỏ qua */ } }, finaleAt));
  } catch {
    release();
  }
}
