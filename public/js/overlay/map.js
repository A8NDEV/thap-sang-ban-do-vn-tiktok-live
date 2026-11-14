// Lớp Z-1: bản đồ SVG 34 tỉnh, thành nổi khối 3D + quần đảo Hoàng Sa, Trường Sa.
import { PROVINCES, HOANG_SA, TRUONG_SA } from '../../data/mapdata.js';
import { INFO } from '../../data/tinh.js';
import { $ } from './util.js';

const NS = 'http://www.w3.org/2000/svg';
export const P = {};     // tên → { path, hl, sd, label, cx, cy, size, mk }

// điểm đặt ảnh + tên: điểm nằm sâu nhất bên trong ranh giới tỉnh (không lọt ra ngoài như tâm hình học ở tỉnh cong, hẹp)
function pole(path, cx, cy){
  const b = path.getBBox(), len = path.getTotalLength(), edge = [];
  for (let i = 0; i < 260; i++) edge.push(path.getPointAtLength(len * i / 260));
  // SVGPoint (createSVGPoint): Chromium của Electron 33 (app .exe / cửa sổ OBS) không nhận DOMPoint ở isPointInFill → overlay lỗi trắng bản đồ
  const step = Math.max(3, Math.min(b.width, b.height) / 16), pt = path.ownerSVGElement?.createSVGPoint ? path.ownerSVGElement.createSVGPoint() : new DOMPoint();
  let best = null, bs = -1e9;
  for (let x = b.x + step / 2; x < b.x + b.width; x += step) for (let y = b.y + step / 2; y < b.y + b.height; y += step) {
    pt.x = x; pt.y = y; if (!path.isPointInFill(pt)) continue;
    let d = 1e9; for (const e of edge) { const dd = (e.x - x) ** 2 + (e.y - y) ** 2; if (dd < d) d = dd; }
    const sc = Math.sqrt(d) - .12 * Math.hypot(x - cx, y - cy);
    if (sc > bs) { bs = sc; best = { x, y }; }
  }
  return best || { x: cx, y: cy };
}
// tinh chỉnh tay vài tỉnh nhỏ ở đồng bằng sông Hồng cho ảnh và tên khỏi chồng nhau
const NUDGE = { 'Hà Nội': [0, 4], 'Hưng Yên': [2, 6], 'Hải Phòng': [6, 0], 'Bắc Ninh': [0, -2] };

export function placeLabel(v, on){ v.label.setAttribute('x', v.cx); v.label.setAttribute('y', on ? v.cy + 14 : v.cy + 5); v.sd.setAttribute('class', on ? 'sd on' : 'sd'); }

function islandDots(el, pts, scale){
  const box = el.querySelector('.dots');
  for (const [x, y, s] of pts) { const i = document.createElement('i'), r = (s || 1) * scale; i.style.cssText = `left:${x * 100}%;top:${y * 100}%;width:${r}px;height:${r}px;margin:${-r / 2}px 0 0 ${-r / 2}px`; box.appendChild(i); }
}

export function buildMap(){
  for (const p of PROVINCES) {
    const path = document.createElementNS(NS, 'path'); path.setAttribute('d', p.d); path.setAttribute('class', 'pv'); $('#offG').appendChild(path);
    // thành bên khối nổi: 8 lớp xếp chồng lệch xuống (4 lớp trên chỉ hiện khi tỉnh sáng → tỉnh sáng nhô cao hơn)
    const sd = document.createElementNS(NS, 'g'); sd.setAttribute('class', 'sd');
    for (const dy of [-4.5, -3, -1.5, 0, 1.5, 3, 4.5, 6]) { const c = document.createElementNS(NS, 'path'); c.setAttribute('d', p.d); c.setAttribute('transform', `translate(0 ${dy})`); c.style.setProperty('--dy', dy); sd.appendChild(c); }
    $('#sideG').appendChild(sd);
    const hl = document.createElementNS(NS, 'path'); hl.setAttribute('d', p.d); hl.setAttribute('class', 'hl'); $('#topG').appendChild(hl);
    const t = document.createElementNS(NS, 'text'); t.setAttribute('class', 'lb'); t.textContent = INFO[p.ten]?.short || p.ten; $('#lbG').appendChild(t);
    P[p.ten] = { path, hl, sd, label: t, cx: p.cx, cy: p.cy };
  }
  for (const [ten, v] of Object.entries(P)) {
    const b = v.path.getBBox(); v.size = (b.width < 75 || b.height < 55) ? 'sm' : (b.width >= 110 && b.height >= 100) ? 'lg' : 'md';
    const a = pole(v.path, v.cx, v.cy), [dx, dy] = NUDGE[ten] || [0, 0];
    v.cx = Math.round(a.x + dx); v.cy = Math.round(a.y + dy);
    placeLabel(v, false);
  }
  islandDots($('#islHS'), HOANG_SA, 3.4); islandDots($('#islTS'), TRUONG_SA, 1.6);
}
