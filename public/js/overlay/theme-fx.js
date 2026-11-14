// Lớp Z-3: hiệu ứng RIÊNG từng style (mac-dinh ở đây; 7 style còn lại trong gói giao diện goi-style/) — không chỉ đổi màu.
//   arrive(tỉnh, lớn)  lúc đèn bừng sáng tại tỉnh       travel(a, b)  đường bay từ thẻ "vừa thắp" về tỉnh
//   ambient()          không khí nền lúc rảnh (gọi ~1s/lần) nation()   cả nước rực sáng
// Mọi hạt dùng Web Animations (transform/opacity), tự xóa khi xong, giới hạn số hạt sống → chạy 24/7 không nặng dần.
import { $ } from './util.js';
import { P } from './map.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const theme = () => document.documentElement.dataset.theme || 'mac-dinh';
const lite = () => document.body.classList.contains('lite');
const MAX = 220, live = document.getElementsByClassName('tf');

// tạo 1 hạt tại (x,y) trong `parent`, chạy keyframes rồi tự xóa
function part(parent, cls, x, y, frames, opt, html){
  if (live.length >= MAX) return null;
  const e = document.createElement('i'); e.className = 'tf ' + cls; if (html) e.innerHTML = html;
  e.style.left = x + 'px'; e.style.top = y + 'px'; parent.appendChild(e);
  const a = e.animate(frames, { fill: 'both', ...opt });
  a.onfinish = a.oncancel = () => e.remove();
  return e;
}
const marks = () => $('#marks'), sky = () => $('#skyFx'), bg = () => $('#themeBg');

/* ---------- toạ độ màn hình (khung 1080×1920) của tỉnh đang nằm trong camera + bản đồ nghiêng ---------- */
function toStage(r){ const st = $('#stage').getBoundingClientRect(), k = st.width / 1080; return { x: (r.left + r.width / 2 - st.left) / k, y: (r.top + r.height / 2 - st.top) / k }; }
export function stagePt(ten){ const v = P[ten]; if (!v) return null; const e = document.createElement('i'); e.style.cssText = `position:absolute;left:${v.cx}px;top:${v.cy}px;width:2px;height:2px`; marks().appendChild(e); const p = toStage(e.getBoundingClientRect()); e.remove(); return p; }
export function cardPt(){ const a = document.querySelector('#lastBody .bigAv') || $('#lastCard'); return toStage(a.getBoundingClientRect()); }

// đường cong bậc 2 từ a → b (vồng lên trên), lấy N+1 điểm kèm góc
function curve(a, b, N = 16, lift = 160){
  const cx = (a.x + b.x) / 2 + (b.y - a.y) * .18, cy = Math.min(a.y, b.y) - lift, pts = [];
  for (let i = 0; i <= N; i++) { const t = i / N, u = 1 - t; pts.push({ x: u * u * a.x + 2 * u * t * cx + t * t * b.x, y: u * u * a.y + 2 * u * t * cy + t * t * b.y }); }
  return pts.map((p, i) => { const q = pts[Math.min(N, i + 1)], o = pts[Math.max(0, i - 1)]; return { ...p, ang: Math.atan2(q.y - o.y, q.x - o.x) }; });
}
// sao chổi chung: đầu + đuôi đốm; dropAt(x,y,t) để style rắc thêm hạt dọc đường
function comet(a, b, cls, dropAt, dur = 600){
  const path = curve(a, b), frames = sc => path.map(p => ({ transform: `translate(${p.x}px,${p.y}px) rotate(${p.ang}rad) scale(${sc})` }));
  for (let k = 0; k < 6; k++) part(sky(), (k ? 'cmt tail ' : 'cmt ') + cls, 0, 0, frames(1 - k * .14), { duration: dur, delay: k * 34, easing: 'cubic-bezier(.45,.05,.55,1)' });
  if (dropAt) path.forEach((p, i) => i % 2 || setTimeout(() => dropAt(p.x, p.y), i / path.length * dur));
}

// đèn lồng bay lên (dùng chung: Sơn Mài, Hội An)
function lantern(parent, x, y, s = 1, dur = 3600, rise = 260){
  const sw = rnd(10, 22) * s;
  return part(parent, 'lantern', x, y, [
    { transform: `translate(-50%,-50%) scale(${.3 * s})`, opacity: 0 },
    { transform: `translate(calc(-50% + ${sw}px), calc(-50% - ${rise * .3}px)) scale(${s}) rotate(6deg)`, opacity: 1, offset: .25 },
    { transform: `translate(calc(-50% - ${sw}px), calc(-50% - ${rise * .65}px)) scale(${s}) rotate(-6deg)`, opacity: 1, offset: .65 },
    { transform: `translate(-50%, calc(-50% - ${rise}px)) scale(${.8 * s}) rotate(3deg)`, opacity: 0 }], { duration: dur, easing: 'ease-out' });
}

/* =====================================================================
   ĐÊM VÀNG (mặc định): sao vàng lấp lánh bung ra
   ===================================================================== */
const macDinh = {
  arrive(ten, big){ const v = P[ten]; for (let i = 0; i < (big ? 16 : 10); i++) { const a = rnd(0, 6.28), r = rnd(30, 70); part(marks(), 'sparkle', v.cx, v.cy, [{ transform: 'translate(-50%,-50%) scale(.2) rotate(0)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * r}px), calc(-50% + ${Math.sin(a) * r}px)) scale(1) rotate(180deg)`, opacity: 0 }], { duration: rnd(900, 1400), easing: 'cubic-bezier(.1,.8,.3,1)' }, '✦'); } },
  travel(a, b){ comet(a, b, ''); },
  ambient(){}, nation(){},
};

// 7 style còn lại: gói giao diện tải sau khi kích hoạt key (theme.js nạp /style/<id>.js rồi đăng ký vào đây)
const FX = { 'mac-dinh': macDinh };
export function registerStyle(id, fx){ FX[id] = fx; }
const cur = () => FX[theme()] || macDinh;
export function themeArrive(ten, big){ if (!lite() && P[ten]) cur().arrive(ten, big); }
export function themeTravel(a, b){ cur().travel(a, b); }
export function themeNation(){ if (!lite()) cur().nation(); }
let tick = 0;
export function startThemeAmbient(){ setInterval(() => { tick++; if (!lite() && !document.hidden) cur().ambient(tick); }, 1000); }

// dựng nền tĩnh/động riêng của style (style nào có hàm setup thì dùng)
export function setupThemeBg(t, el){ FX[t]?.setup?.(el); }
// bộ công cụ cho các file hiệu ứng style riêng
export { part, curve, comet, lantern, rnd, pick, marks, sky, bg, lite };
