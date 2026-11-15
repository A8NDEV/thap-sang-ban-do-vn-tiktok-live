// Không khí lúc vắng: đom đóm vàng lơ lửng, thỉnh thoảng một đèn lồng thả lên và một sao băng mờ.
// Gọi startAmbient()/stopAmbient() theo cờ fxOn('ambient') mỗi lần nhận `state`: cả hai idempotent.
// Chỉ animate transform + opacity (WAAPI); đúng một setInterval 1 giây khi đang chạy, không có khi tắt; không rAF.
// Mọi phần tử tự dọn đúng một lần, ngân sách nhả đúng một lần.
import { $ } from './util.js';
import { isLite } from './theme.js';
import { qualityLevel } from './fx-perf.js';
import { createBudget } from './fx-cinema-logic.js';

if (typeof document !== 'undefined' && !document.getElementById('fx-ambient-css')) {
  const link = document.createElement('link');
  link.id = 'fx-ambient-css';
  link.rel = 'stylesheet';
  link.href = new URL('../../css/fx-ambient.css', import.meta.url).href;
  document.head?.appendChild(link);
}

const FIREFLY_MAX = 10, FIREFLY_LOW = 4;
// vùng bản đồ trên sân khấu 1080x1920: #mapBox rộng 738, cao từ 232 tới 1784
const X0 = 30, X1 = 710, Y0 = 270, Y1 = 1750;
const lanternBudget = createBudget(1);
const starBudget = createBudget(1);
const rnd = (a, b) => a + Math.random() * (b - a);

let box = null;           // container duy nhất của hiệu ứng
let tick = 0;             // id setInterval duy nhất
let flies = [];           // { el, anim }
const transient = new Set();   // hàm kết thúc của đèn lồng / sao băng đang chạy
let nextLantern = 0, nextStar = 0;
let visHooked = false;

function onVis() {
  for (const f of flies) {
    try { if (document.hidden) f.anim?.pause(); else f.anim?.play(); } catch { /* bỏ qua */ }
  }
}

function addFirefly() {
  if (!box) return;
  let el = null;
  try {
    el = document.createElement('i');
    el.className = 'am-ff';
    const r = rnd(3, 7);
    el.style.width = el.style.height = (r * 2) + 'px';
    el.style.margin = (-r) + 'px 0 0 ' + (-r) + 'px';
    const x = rnd(X0, X1), y = rnd(Y0, Y1);
    const dx = rnd(-70, 70), dy = rnd(-90, 90), dx2 = rnd(-70, 70), dy2 = rnd(-90, 90);
    const dur = rnd(20000, 40000);
    box.appendChild(el);
    const anim = el.animate([
      { transform: `translate3d(${x}px, ${y}px, 0)`, opacity: 0.15 },
      { transform: `translate3d(${x + dx}px, ${y + dy}px, 0)`, opacity: 0.85, offset: 0.35 },
      { transform: `translate3d(${x + dx2}px, ${y + dy2}px, 0)`, opacity: 0.3, offset: 0.7 },
      { transform: `translate3d(${x + dx + dx2}px, ${y + dy + dy2}px, 0)`, opacity: 0.8 },
    ], { duration: dur, delay: -rnd(0, dur), iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
    if (document.hidden) anim.pause();
    flies.push({ el, anim });
  } catch {
    try { el?.remove(); } catch { /* bỏ qua */ }
  }
}

function dropFirefly() {
  const f = flies.pop();
  if (!f) return;
  try { f.anim?.cancel(); } catch { /* bỏ qua */ }
  try { f.el.remove(); } catch { /* bỏ qua */ }
}

function syncFireflies() {
  const want = qualityLevel() >= 1 ? FIREFLY_LOW : FIREFLY_MAX;
  while (flies.length > want) dropFirefly();
  while (flies.length < want && box) { const n = flies.length; addFirefly(); if (flies.length === n) break; }
}

// Đèn lồng / sao băng: chạy một lần, tự dọn đúng một lần (finished, hết hạn dự phòng, hoặc stopAmbient).
function spawnOnce(budget, cls, keyframes, opts) {
  if (!box || !budget.tryAcquire()) return;
  let el = null, over = false, timer = 0, anim = null;
  const end = () => {
    if (over) return;
    over = true;
    transient.delete(end);
    clearTimeout(timer);
    try { anim?.cancel(); } catch { /* bỏ qua */ }
    try { el?.remove(); } catch { /* bỏ qua */ }
    budget.release();
  };
  try {
    el = document.createElement('i');
    el.className = cls;
    box.appendChild(el);
    transient.add(end);
    timer = setTimeout(end, opts.duration + 500);
    anim = el.animate(keyframes, { fill: 'both', ...opts });
    anim.finished.then(end, end);
  } catch { end(); }
}

function lantern() {
  const x = rnd(60, 680), y = 1760, rise = rnd(900, 1300), sway = rnd(14, 26);
  const k = (o, dx, up, op, rot) => ({ offset: o, opacity: op, transform: `translate3d(${x + dx}px, ${y - up}px, 0) rotate(${rot}deg)` });
  spawnOnce(lanternBudget, 'am-lantern', [
    k(0, 0, 0, 0, 0),
    k(0.1, sway * 0.3, rise * 0.08, 0.85, 3),
    k(0.4, -sway, rise * 0.4, 0.85, -4),
    k(0.7, sway, rise * 0.72, 0.8, 4),
    k(1, -sway * 0.4, rise, 0, 0),
  ], { duration: rnd(16000, 22000), easing: 'ease-out' });
}

function shootingStar() {
  const x = rnd(80, 560), y = rnd(280, 760), len = rnd(300, 420), ang = rnd(18, 32);
  const rad = ang * Math.PI / 180;
  const at = (o, f, op) => ({ offset: o, opacity: op, transform: `translate3d(${x + Math.cos(rad) * len * f}px, ${y + Math.sin(rad) * len * f}px, 0) rotate(${ang}deg)` });
  spawnOnce(starBudget, 'am-star', [at(0, 0, 0), at(0.2, 0.2, 0.55), at(1, 1, 0)], { duration: rnd(900, 1300), easing: 'ease-in' });
}

function onTick() {
  try {
    if (!box || document.hidden) return;
    const now = Date.now(), q = qualityLevel();
    if (now >= nextLantern) { nextLantern = now + rnd(25000, 45000); if (q < 1) lantern(); }
    if (now >= nextStar) { nextStar = now + rnd(40000, 90000); if (q < 1) shootingStar(); }
    syncFireflies();
  } catch { /* hiệu ứng phụ: không bao giờ làm hỏng luồng chính */ }
}

export function startAmbient() {
  try {
    if (isLite()) { stopAmbient(); return; }
    if (box) { if (box.isConnected) return; stopAmbient(); }
    const stage = $('#stage');
    if (!stage || typeof stage.animate !== 'function') return;
    box = document.createElement('div');
    box.id = 'fxAmbient';
    // đặt ngay trước #head: nằm trên bản đồ, dưới mọi thẻ/bảng sau đó
    const head = $('#head');
    if (head && head.parentNode === stage) stage.insertBefore(box, head); else stage.appendChild(box);
    syncFireflies();
    const now = Date.now();
    nextLantern = now + rnd(25000, 45000);
    nextStar = now + rnd(40000, 90000);
    tick = setInterval(onTick, 1000);
    if (!visHooked) { document.addEventListener('visibilitychange', onVis); visHooked = true; }
  } catch {
    stopAmbient();
  }
}

export function stopAmbient() {
  try { if (tick) clearInterval(tick); } catch { /* bỏ qua */ }
  tick = 0;
  if (visHooked) { try { document.removeEventListener('visibilitychange', onVis); } catch { /* bỏ qua */ } visHooked = false; }
  for (const end of [...transient]) end();
  while (flies.length) dropFirefly();
  try { box?.remove(); } catch { /* bỏ qua */ }
  box = null;
}
