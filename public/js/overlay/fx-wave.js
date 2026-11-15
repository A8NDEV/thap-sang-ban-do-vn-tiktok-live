// Ánh sáng lan: khi một tỉnh sáng lần đầu, các tỉnh kề đang sáng nháy mờ-rồi-sáng lại lần lượt, lan ra từ tỉnh đó.
// Chỉ animate opacity (WAAPI) trên phần tử đường của tỉnh, không đổi class `on`, không để lại fill.
// Một đợt sóng một lúc; đợt mới trong lúc đang chạy bị bỏ. Không timer nào khi không có sóng.
import { P } from './map.js';
import { isLite } from './theme.js';

const RADIUS = 170, MAX_PROV = 8, MS_PER_PX = 2.2, DUR = 700;
let running = false;

// Chọn tối đa 8 tỉnh đang sáng, tâm cách `prov` không quá 170 px, gần trước. Hàm thuần trên P.
export function waveTargets(prov) {
  if (!P || !Object.hasOwn(P, prov)) return [];
  const o = P[prov];
  if (!o || !Number.isFinite(o.cx) || !Number.isFinite(o.cy)) return [];
  const out = [];
  for (const t of Object.keys(P)) {
    if (t === prov) continue;
    const v = P[t];
    if (!v?.path || !Number.isFinite(v.cx) || !Number.isFinite(v.cy)) continue;
    if (!v.path.classList?.contains('on')) continue;
    const dist = Math.hypot(v.cx - o.cx, v.cy - o.cy);
    if (dist <= RADIUS) out.push({ t, dist, path: v.path });
  }
  out.sort((a, b) => a.dist - b.dist);
  return out.slice(0, MAX_PROV);
}

export function lightWave(prov) {
  if (running) return;
  let timer = 0;
  const anims = [];
  const release = () => {
    if (!running) return;
    running = false;
    clearTimeout(timer);
    for (const a of anims) { try { a.cancel(); } catch { /* bỏ qua */ } }
  };
  try {
    if (isLite()) return;
    const targets = waveTargets(prov);
    if (!targets.length) return;
    running = true;
    let maxEnd = 0;
    for (const { dist, path } of targets) {
      if (typeof path.animate !== 'function') continue;
      const delay = dist * MS_PER_PX;
      maxEnd = Math.max(maxEnd, delay + DUR);
      anims.push(path.animate([{ opacity: 1 }, { opacity: 0.55 }, { opacity: 1 }], { delay, duration: DUR, easing: 'ease-in-out', fill: 'none' }));
    }
    timer = setTimeout(release, maxEnd + 300);
  } catch {
    release();
  }
}
