// Cảnh mở màn ~5 giây: tên "THẮP SÁNG BẢN ĐỒ VIỆT NAM" hiện từng chữ ở đầu vùng bản đồ, các tỉnh hiện lần lượt Bắc -> Nam.
// Chỉ animate transform + opacity (WAAPI) trên phần tử đường; KHÔNG đổi class hay dữ liệu: animate xong là trả về trạng thái thật.
// Không chiếu chồng. Tự chiếu tối đa một lần mỗi lần tải trang (maybeAutoIntro); nút thủ công (force) luôn chiếu.
import { $ } from './util.js';
import { P } from './map.js';
import { isLite } from './theme.js';
import { qualityLevel } from './fx-perf.js';
import { fxOn } from './fx-options.js';

if (typeof document !== 'undefined' && !document.getElementById('fx-intro-css')) {
  const link = document.createElement('link');
  link.id = 'fx-intro-css';
  link.rel = 'stylesheet';
  link.href = new URL('../../css/fx-intro.css', import.meta.url).href;
  document.head?.appendChild(link);
}

const TITLE = 'THẮP SÁNG BẢN ĐỒ VIỆT NAM';
const STAGGER = 35, IN = 400, OUT = 700;
const PROV_STEP = 60, PROV_DUR = 500;

let busy = false;      // đang chiếu: lần gọi chồng bị bỏ
let played = false;    // đã chiếu trên trang này
let decided = false;   // đã xét tự chiếu (chỉ xét ở state đầu tiên có litCount)

export function playIntro({ force = false } = {}) {
  if (busy) return;
  const lite = isLite();
  if (lite && !force) return;
  const stage = $('#stage');
  if (!stage || typeof stage.animate !== 'function') return;
  busy = true;
  played = true;
  let done = false, box = null, timer = 0;
  const provAnims = [];
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    for (const a of provAnims) { try { a.cancel(); } catch { /* bỏ qua */ } }
    try { box?.remove(); } catch { /* bỏ qua */ }
    busy = false;
  };
  try {
    const letters = Array.from(TITLE);
    // lite: chỉ hiện tên ~2 giây; thường: ~5 giây
    const D = lite ? IN + 300 + OUT : 4160, HOLD_END = (D - OUT) / D;
    const total = (letters.length - 1) * STAGGER + D;
    timer = setTimeout(finish, total + 600);

    box = document.createElement('div');
    box.className = 'in-title';
    const spans = letters.map(ch => { const s = document.createElement('span'); s.textContent = ch; box.appendChild(s); return s; });
    stage.appendChild(box);
    const anims = [];
    spans.forEach((s, i) => {
      try {
        anims.push(s.animate([
          { transform: 'translate3d(0, 18px, 0) scale(.7)', opacity: 0, offset: 0, easing: 'ease-out' },
          { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1, offset: IN / D },
          { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1, offset: HOLD_END, easing: 'ease-in' },
          { transform: 'translate3d(0, -14px, 0) scale(.95)', opacity: 0, offset: 1 },
        ], { delay: i * STAGGER, duration: D, fill: 'both' }).finished);
      } catch { /* bỏ qua */ }
    });

    // các tỉnh hiện dần theo cy (Bắc -> Nam); fill 'backwards' để giữ mờ trong lúc chờ trễ, xong thì trả về trạng thái thật
    if (!lite && qualityLevel() < 2 && P) {
      const list = Object.keys(P).filter(t => P[t]?.path && typeof P[t].path.animate === 'function' && Number.isFinite(P[t].cy)).sort((a, b) => P[a].cy - P[b].cy);
      list.forEach((t, rank) => {
        try {
          const a = P[t].path.animate([{ opacity: 0.15 }, { opacity: 1 }], { delay: rank * PROV_STEP, duration: PROV_DUR, fill: 'backwards', easing: 'ease-out' });
          provAnims.push(a);
          anims.push(a.finished);
        } catch { /* bỏ qua */ }
      });
    }
    Promise.allSettled(anims).then(finish);
  } catch {
    finish();
  }
}

// Gọi trong handler `state` (sau setFxOptions): chỉ xét ở state đầu tiên của trang.
export function maybeAutoIntro(state) {
  try {
    if (decided || !state || typeof state.litCount !== 'number') return;
    decided = true;
    if (played || !fxOn('intro') || state.litCount !== 0) return;
    playIntro({ force: false });
  } catch { /* bỏ qua */ }
}
