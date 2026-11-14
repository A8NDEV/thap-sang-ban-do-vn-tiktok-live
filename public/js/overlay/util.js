import { INFO } from '../../data/tinh.js';

export const $ = s => document.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const COLORS = ['#e8505b', '#f39c12', '#16a085', '#2980b9', '#8e44ad', '#d35400', '#27ae60', '#c0392b', '#2c82c9'];
const hue = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return COLORS[h % COLORS.length]; };
// ảnh đại diện: chỉ nhận https, lỗi ảnh thì hiện chữ cái đầu
export function avatar(el, name, url){
  el.textContent = ''; el.style.backgroundImage = ''; el.style.backgroundColor = hue(name);
  const ini = (String(name || '?').trim()[0] || '?').toUpperCase();
  if (url && /^https:\/\//.test(url)) { el.style.backgroundImage = `url("${url.replace(/"/g, '%22')}")`; const img = new Image(); img.onerror = () => { el.style.backgroundImage = ''; el.textContent = ini; }; img.src = url; }
  else el.textContent = ini;
}
export const short = t => INFO[t]?.short || t;

// số chạy dần tới giá trị mới (thay vì nhảy ngay)
const easeOut = t => 1 - (1 - t) ** 3;
export function tweenNum(el, to, ms = 700){
  const from = +String(el.textContent).replace(/[^\d-]/g, '') || 0;
  if (from === to || document.body.classList.contains('lite')) { el.textContent = to; return; }
  const t0 = performance.now(), id = (el._tw = (el._tw || 0) + 1);
  const step = now => { if (el._tw !== id) return; const k = Math.min(1, (now - t0) / ms); el.textContent = Math.round(from + (to - from) * easeOut(k)); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
// danh sách xếp hạng đổi chỗ mượt (FLIP): dòng cũ trượt tới vị trí mới, dòng mới hiện dần, điểm chạy số
export function flipList(box, html){
  if (box._h === html) return; box._h = html;
  const before = new Map();
  for (const r of box.children) if (r.dataset.id) before.set(r.dataset.id, { top: r.offsetTop, pt: r.querySelector('.pt')?.textContent, w: r.querySelector('.fill')?.style.width });
  box.innerHTML = html;
  const lite = document.body.classList.contains('lite');
  [...box.children].forEach((r, i) => {
    if (!r.dataset.id) return;
    const b = before.get(r.dataset.id);
    if (!b) { if (!lite) r.animate([{ opacity: 0, transform: 'translateX(24px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: i * 50, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'backwards' }); return; }
    const dy = b.top - r.offsetTop;
    if (dy && !lite) r.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 650, easing: 'cubic-bezier(.25,1.2,.35,1)' });
    const f = r.querySelector('.fill');
    if (f && b.w && b.w !== f.style.width) { const w = f.style.width; f.style.width = b.w; requestAnimationFrame(() => requestAnimationFrame(() => { f.style.width = w; })); }
    const pt = r.querySelector('.pt');
    if (pt && b.pt !== undefined && b.pt !== pt.textContent) { const to = +pt.textContent; pt.textContent = b.pt; tweenNum(pt, to); r.classList.add('bump'); setTimeout(() => r.classList.remove('bump'), 700); }
  });
}
