// "Kính lúp" cho quà lớn: cửa sổ tròn phóng to riêng tỉnh nhận quà, bản đồ chính đứng yên.
// Chỉ animate transform + opacity (WAAPI). Dọn đúng một lần, nhả ngân sách đúng một lần.
import { $, avatar } from './util.js';
import { P } from './map.js';
import { isLite } from './theme.js';
import { qualityLevel } from './fx-perf.js';
import { giftTier, createBudget } from './fx-cinema-logic.js';
import { levelClass } from './fx-donors.js';

if (typeof document !== 'undefined' && !document.getElementById('fx-lens-css')) {
  const link = document.createElement('link');
  link.id = 'fx-lens-css';
  link.rel = 'stylesheet';
  link.href = new URL('../../css/fx-lens.css', import.meta.url).href;
  document.head?.appendChild(link);
}

const NS = 'http://www.w3.org/2000/svg';
const ENTER = 360, HOLD = 2400, LEAVE = 320, TOTAL = ENTER + HOLD + LEAVE;
const lensBudget = createBudget(1);
let lensOn = true;

export function setLensOn(on) { lensOn = !!on; }

const clip = (s) => Array.from(String(s ?? '')).slice(0, 28).join('');
const div = (cls) => Object.assign(document.createElement('div'), { className: cls });

// SVG chỉ chứa riêng tỉnh, viewBox vuông vừa khít bbox + 18% mỗi bên.
function buildProvinceSvg(path) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const defs = document.createElementNS(NS, 'defs');
  const grad = document.createElementNS(NS, 'linearGradient');
  grad.setAttribute('id', 'lensGold');
  grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0'); grad.setAttribute('x2', '0'); grad.setAttribute('y2', '1');
  for (const [o, c] of [['0', '#ffe9a0'], ['0.55', '#ffc83d'], ['1', '#e08a14']]) {
    const st = document.createElementNS(NS, 'stop');
    st.setAttribute('offset', o); st.setAttribute('stop-color', c);
    grad.appendChild(st);
  }
  defs.appendChild(grad);
  const g = document.createElementNS(NS, 'g');
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', path.getAttribute('d') || '');
  const tf = path.getAttribute('transform');
  if (tf) p.setAttribute('transform', tf);
  p.setAttribute('fill', 'url(#lensGold)');
  p.setAttribute('stroke', '#fff6d8');
  p.setAttribute('stroke-linejoin', 'round');
  g.appendChild(p);
  svg.append(defs, g);
  return { svg, g, p };
}

function fitViewBox(svg, g, p, origPath) {
  let b = null;
  try { b = g.getBBox(); } catch { /* chưa gắn vào DOM */ }
  if (!b || !(b.width > 0) || !(b.height > 0)) b = origPath.getBBox();
  const side = Math.max(b.width, b.height) * 1.36;
  const x = b.x + b.width / 2 - side / 2, y = b.y + b.height / 2 - side / 2;
  svg.setAttribute('viewBox', `${x} ${y} ${side} ${side}`);
  p.setAttribute('stroke-width', String(+(side * 0.012).toFixed(3)));
}

export function showLens({ prov, name, avatar: avatarUrl, gift, coins, level } = {}) {
  try {
    if (!lensOn) return;
    if (isLite()) return;
    if (qualityLevel() >= 2) return;
    if (giftTier(coins) < 2) return;
    if (!P || !Object.hasOwn(P, prov) || !P[prov]?.path) return;
    const stage = $('#stage');
    if (!stage) return;
    if (!lensBudget.tryAcquire()) return;

    let el = null;
    let over = false;
    const finish = () => {
      if (over) return;
      over = true;
      el?.remove();
      lensBudget.release();
    };
    try {
      setTimeout(finish, TOTAL + 600);
      const orig = P[prov].path;

      el = div('lens');
      const win = div('lens-win');
      const ring = div('lens-ring');
      const { svg, g, p } = buildProvinceSvg(orig);
      win.appendChild(svg);
      svg.setAttribute('viewBox', '0 0 1 1');

      const av = div('lens-av');
      avatar(av, name, avatarUrl);
      const lc = level > 0 ? levelClass(level) : '';
      if (lc) av.classList.add(lc);
      const l1 = div('lens-name');
      l1.textContent = clip(name);
      const l2 = div('lens-gift');
      l2.textContent = `🎁 ${clip(gift)} · ${Number(coins).toLocaleString('vi-VN')} xu`;
      el.append(ring, win, av, l1, l2);
      stage.appendChild(el);
      fitViewBox(svg, g, p, orig);

      const a = (node, kf, opts) => { try { return node.animate(kf, { duration: TOTAL, fill: 'both', ...opts }).finished; } catch { return Promise.resolve(); } };
      const tIn = ENTER / TOTAL, tOut = (ENTER + HOLD) / TOTAL;
      const done = [
        a(el, [
          { transform: 'scale(.7)', opacity: 0, easing: 'ease-out' },
          { offset: tIn, transform: 'scale(1)', opacity: 1, easing: 'linear' },
          { offset: tOut, transform: 'scale(1)', opacity: 1, easing: 'ease-in' },
          { transform: 'scale(.85)', opacity: 0 },
        ], {}),
        a(ring, [
          { transform: 'scale(1)', opacity: 0 },
          { offset: tIn, transform: 'scale(1)', opacity: 0.85, easing: 'ease-out' },
          { offset: 0.5, transform: 'scale(1.4)', opacity: 0 },
          { transform: 'scale(1.4)', opacity: 0 },
        ], {}),
      ];
      Promise.allSettled(done).then(finish);
    } catch { finish(); }
  } catch { /* hiệu ứng phụ: không bao giờ làm hỏng luồng chính */ }
}
