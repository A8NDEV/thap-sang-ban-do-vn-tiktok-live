// Cấp độ người tặng quà: khung ảnh theo cấp, thẻ "lên cấp", cảnh "vượt hạng".
// Chỉ animate transform + opacity (WAAPI). Mọi phần tử dọn đúng một lần, ngân sách nhả đúng một lần.
import { $, avatar } from './util.js';
import { isLite } from './theme.js';
import { qualityLevel } from './fx-perf.js';
import { createBudget } from './fx-cinema-logic.js';
import { screenShake } from './particles.js';
import { playSfx } from './audio.js';

if (typeof document !== 'undefined' && !document.getElementById('fx-donors-css')) {
  const link = document.createElement('link');
  link.id = 'fx-donors-css';
  link.rel = 'stylesheet';
  link.href = new URL('../../css/fx-donors.css', import.meta.url).href;
  document.head?.appendChild(link);
}

const LV_CLASSES = ['lv1', 'lv2', 'lv3', 'lv4'];
const levelBudget = createBudget(1);
const overtakeBudget = createBudget(1);

const clip = (s) => Array.from(String(s ?? '')).slice(0, 28).join('');
const div = (cls, text) => {
  const el = Object.assign(document.createElement('div'), { className: cls });
  if (text != null) el.textContent = text;
  return el;
};

// 0/không hợp lệ -> '' ; 1..4 -> 'lv1'..'lv4' (lớn hơn 4 coi như cấp cao nhất).
export function levelClass(level) {
  const n = Math.trunc(Number(level));
  if (!(n >= 1)) return '';
  return 'lv' + Math.min(4, n);
}

// Khung ảnh của banner: phần tử #banner .bav dùng lại giữa các sự kiện nên luôn xoá lớp cũ trước.
// Banner khác (không phải quà) sẽ ghi đè dòng .k -> quan sát để gỡ khung, tránh dính sang banner khác.
let bannerWatch = null;
export function applyBannerFrame(level) {
  try {
    bannerWatch?.disconnect();
    bannerWatch = null;
    const av = $('#banner .bav');
    if (!av) return;
    av.classList.remove(...LV_CLASSES);
    const c = levelClass(level);
    if (!c) return;
    av.classList.add(c);
    const k = $('#banner .k');
    if (k && typeof MutationObserver !== 'undefined') {
      bannerWatch = new MutationObserver(() => {
        try { av.classList.remove(...LV_CLASSES); } catch { /* bỏ qua */ }
        bannerWatch?.disconnect();
        bannerWatch = null;
      });
      bannerWatch.observe(k, { childList: true, characterData: true, subtree: true });
    }
  } catch { /* hiệu ứng phụ: không bao giờ làm hỏng luồng chính */ }
}

// Dựng một cảnh: gắn vào #stage, chạy animation, dọn + nhả ngân sách đúng một lần.
// build(el) -> trả về danh sách animation phụ (promise) hoặc không; keyframes cho phần tử gốc.
function playScene(budget, total, el, keyframes, extra) {
  const stage = $('#stage');
  if (!stage) return false;
  if (!budget.tryAcquire()) return false;
  let over = false;
  const finish = () => {
    if (over) return;
    over = true;
    try { el.remove(); } catch { /* bỏ qua */ }
    budget.release();
  };
  try {
    setTimeout(finish, total + 600);
    stage.appendChild(el);
    const a = (node, kf, opts) => {
      try { return node.animate(kf, { duration: total, fill: 'both', ...opts }).finished; } catch { return Promise.resolve(); }
    };
    const done = [a(el, keyframes, {})];
    if (extra) done.push(...extra(a));
    Promise.allSettled(done).then(finish);
  } catch { finish(); }
  return true;
}

// Thẻ lên cấp: trượt từ trên xuống, giữa trên sân khấu. Cái sau đến khi đang chiếu thì bỏ (không xếp hàng).
const LV_TOTAL = 3200, LV_IN = 420, LV_OUT = 420;
export function showLevelUp(ev) {
  try {
    if (!ev || isLite()) return;
    const c = levelClass(ev.level);
    if (!c) return;
    if (levelBudget.active > 0) return;

    const card = div('lvu ' + c);
    const av = div('dn-av ' + c);
    avatar(av, ev.name, ev.avatar);
    const tx = div('lvu-tx');
    const name = clip(ev.levelName) || 'MỚI';
    tx.append(
      div('lvu-k', `${clip(ev.name) || 'Ai đó'} LÊN CẤP ${name.toUpperCase()}!`),
      div('lvu-s', ev.next ? `còn ${Number(ev.need) || 0} xu lên ${clip(ev.next)}` : 'đã đạt cấp cao nhất!'),
    );
    card.append(av, tx);

    const tIn = LV_IN / LV_TOTAL, tOut = 1 - LV_OUT / LV_TOTAL;
    playScene(levelBudget, LV_TOTAL, card, [
      { transform: 'translateY(-140px) scale(.92)', opacity: 0, easing: 'cubic-bezier(.2,1.2,.4,1)' },
      { offset: tIn, transform: 'translateY(0) scale(1)', opacity: 1, easing: 'linear' },
      { offset: tOut, transform: 'translateY(0) scale(1)', opacity: 1, easing: 'ease-in' },
      { transform: 'translateY(-60px) scale(.96)', opacity: 0 },
    ]);
  } catch { /* hiệu ứng phụ */ }
}

// Cảnh vượt hạng: dải ngang rộng 900 ở y ~640, vào bằng translateX, ⚡ phóng nhẹ.
const OT_TOTAL = 2800, OT_IN = 380, OT_OUT = 380;
export function showOvertake(ev) {
  try {
    if (!ev || isLite()) return;
    if (overtakeBudget.active > 0) return;
    const a = clip(ev.name) || 'Ai đó';
    const b = clip(ev.passedName);
    const rank = Math.trunc(Number(ev.rank));
    const rk = rank >= 1 ? rank : 0;

    const band = div('ovt');
    const row = div('ovt-row');
    const avA = div('dn-av');
    avatar(avA, a, ev.avatar);
    const bolt = div('ovt-bolt', '⚡');
    row.append(avA, bolt);
    if (b) {
      const avB = div('dn-av');
      avatar(avB, b, ev.passedAvatar);
      row.append(avB);
    }
    const text = b
      ? `${a.toUpperCase()} VƯỢT ${b.toUpperCase()}${rk ? ` · HẠNG ${rk}` : ''}`
      : `${a.toUpperCase()} VÀO TOP${rk ? ` ${rk}` : ''}`;
    band.append(row, div('ovt-tx', text));

    const tIn = OT_IN / OT_TOTAL, tOut = 1 - OT_OUT / OT_TOTAL;
    const ok = playScene(overtakeBudget, OT_TOTAL, band, [
      { transform: 'translateX(-1100px)', opacity: 0, easing: 'cubic-bezier(.2,.9,.3,1)' },
      { offset: tIn, transform: 'translateX(0)', opacity: 1, easing: 'linear' },
      { offset: tOut, transform: 'translateX(0)', opacity: 1, easing: 'ease-in' },
      { transform: 'translateX(1100px)', opacity: 0 },
    ], (anim) => (qualityLevel() >= 2 ? [] : [anim(bolt, [
      { transform: 'scale(.6)', easing: 'ease-out' },
      { offset: 0.2, transform: 'scale(1.5)', easing: 'ease-in-out' },
      { offset: 0.4, transform: 'scale(1)' },
      { transform: 'scale(1)' },
    ], {})]));
    if (!ok) return;
    try { screenShake('sm'); } catch { /* bỏ qua */ }
    try { playSfx('thunder'); } catch { /* bỏ qua */ }
  } catch { /* hiệu ứng phụ */ }
}
