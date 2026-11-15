// Bầu trời đổi theo giờ thật của máy: lớp #skyTint (hai lớp A/B chồng nhau) nằm ngay trước #stars trong #stage.
// Đổi khung giờ thì chuyển màu chéo bằng opacity. setSky(on) gọi mỗi lần nhận `state`, idempotent.
// Đúng một setInterval 60 giây khi đang bật; tắt (hoặc isLite) thì gỡ lớp và xoá timer. Không rAF.
import { $ } from './util.js';
import { isLite } from './theme.js';
import { skyPhase, SKY_COLORS, nextChangeMs } from './fx-sky-logic.js';

if (typeof document !== 'undefined' && !document.getElementById('fx-sky-css')) {
  const link = document.createElement('link');
  link.id = 'fx-sky-css';
  link.rel = 'stylesheet';
  link.href = new URL('../../css/fx-sky.css', import.meta.url).href;
  document.head?.appendChild(link);
}

let box = null, layers = null, front = 0, phase = null, timer = 0;

function hourNow() {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
}

function apply() {
  if (!box || !layers) return;
  const ph = skyPhase(hourNow());
  if (ph === phase) return;
  const first = phase === null;
  phase = ph;
  const [top, bottom] = SKY_COLORS[ph];
  const next = first ? front : 1 - front;
  layers[next].style.background = `linear-gradient(180deg, ${top} 0%, ${bottom} 100%)`;
  layers[next].classList.add('show');
  if (!first) layers[front].classList.remove('show');
  front = next;
  try { console.info('[fx] bầu trời:', ph, '- đổi sau', Math.round(nextChangeMs() / 60000), 'phút'); } catch { /* bỏ qua */ }
}

function teardown() {
  if (timer) { clearInterval(timer); timer = 0; }
  try { box?.remove(); } catch { /* bỏ qua */ }
  box = null; layers = null; phase = null; front = 0;
}

export function setSky(on) {
  try {
    if (!on || isLite()) { teardown(); return; }
    if (box && box.isConnected) { apply(); return; }
    teardown();
    const stage = $('#stage');
    if (!stage) return;
    box = document.createElement('div');
    box.id = 'skyTint';
    layers = [0, 1].map(() => { const l = document.createElement('div'); l.className = 'sk-l'; box.appendChild(l); return l; });
    const stars = $('#stars');
    if (stars && stars.parentNode === stage) stage.insertBefore(box, stars);
    else stage.insertBefore(box, stage.firstChild);
    apply();
    timer = setInterval(apply, 60000);
  } catch {
    teardown();
  }
}
