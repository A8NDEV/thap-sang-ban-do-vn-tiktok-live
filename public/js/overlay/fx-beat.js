// Bản đồ "đập" theo nhạc / giọng MC: một vòng sáng viền quanh #mapBox với một animation WAAPI vô hạn (transform + opacity).
// Chỉ ĐỌC trạng thái từ audio.js (audioState): không tạo AudioContext / MediaElementSource, không đổi đường đi âm thanh.
// startBeat()/stopBeat() idempotent (gọi mỗi lần nhận `state`). Đúng một setInterval 500 ms khi bật; tắt thì xoá timer và gỡ vòng. Không rAF.
import { $ } from './util.js';
import { isLite } from './theme.js';
import { qualityLevel } from './fx-perf.js';
import { audioState } from './audio.js';

if (typeof document !== 'undefined' && !document.getElementById('fx-beat-css')) {
  const link = document.createElement('link');
  link.id = 'fx-beat-css';
  link.rel = 'stylesheet';
  link.href = new URL('../../css/fx-beat.css', import.meta.url).href;
  document.head?.appendChild(link);
}

const FRAMES = {
  // ~100 BPM (600 ms mỗi nhịp): nhô lên nhanh rồi lắng xuống
  music: { keys: [{ transform: 'scale(1)', opacity: 0.25, offset: 0 }, { transform: 'scale(1.012)', opacity: 0.5, offset: 0.18 }, { transform: 'scale(1)', opacity: 0.25, offset: 1 }], opts: { duration: 600, iterations: Infinity, easing: 'ease-out' } },
  // MC nói: mạnh hơn, thở chậm theo câu (~2 giây)
  talk: { keys: [{ transform: 'scale(1)', opacity: 0.3 }, { transform: 'scale(1.02)', opacity: 0.7 }], opts: { duration: 2000, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' } },
};

let ring = null, anim = null, mode = 'off', timer = 0;

function setMode(next) {
  if (next === mode || !ring) return;
  mode = next;
  try { anim?.cancel(); } catch { /* bỏ qua */ }
  anim = null;
  if (next === 'off') { ring.style.opacity = '0'; return; }
  try {
    const f = FRAMES[next];
    anim = ring.animate(f.keys, f.opts);
  } catch { ring.style.opacity = '0'; mode = 'off'; }
}

function poll() {
  if (!ring) return;
  if (isLite() || qualityLevel() >= 1) { stopBeat(); return; }
  let st = null;
  try { st = audioState(); } catch { /* bỏ qua */ }
  setMode(st?.talking ? 'talk' : st?.music ? 'music' : 'off');
}

export function stopBeat() {
  if (timer) { clearInterval(timer); timer = 0; }
  try { anim?.cancel(); } catch { /* bỏ qua */ }
  anim = null;
  try { ring?.remove(); } catch { /* bỏ qua */ }
  ring = null;
  mode = 'off';
}

export function startBeat() {
  try {
    if (isLite() || qualityLevel() >= 1) { stopBeat(); return; }
    if (ring && ring.isConnected && timer) return;
    stopBeat();
    const stage = $('#stage');
    if (!stage) return;
    ring = document.createElement('div');
    ring.id = 'fxBeat';
    const head = $('#head');
    if (head && head.parentNode === stage) stage.insertBefore(ring, head); else stage.appendChild(ring);
    timer = setInterval(poll, 500);
    poll();
  } catch {
    stopBeat();
  }
}
