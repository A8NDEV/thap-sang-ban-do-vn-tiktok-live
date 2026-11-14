// Lớp Z-0: style màn hình LIVE + nền động riêng từng style + sao lấp lánh, sao băng lúc rảnh.
// mac-dinh có sẵn trong app; 7 style còn lại thuộc GÓI GIAO DIỆN (tải sau khi kích hoạt key) → nạp khi được chọn:
//   /style/<id>.css + /style/<id>.js (export default { setup, arrive, travel, ambient, nation }).
//   Chưa có gói (chưa kích hoạt / đang tải) → hiện mac-dinh, 20 giây thử nạp lại một lần, có gói là tự đổi sang.
// Đổi style khi đang live: phủ mờ 350ms → đổi → hiện lại. ?theme=neon trên đường dẫn để ép style (xem thử).
import { $ } from './util.js';
import { setupThemeBg, registerStyle } from './theme-fx.js';
import { P } from './map.js';

const THEMES = ['mac-dinh', 'son-mai', 'aurora', 'neon', 'hoi-an', 'radar', 'tet', 'giay-co'];
const Q = new URLSearchParams(location.search), forced = Q.get('theme'), forced3d = Q.get('map3d'), forcedLite = Q.get('lite'), forcedZoom = Q.get('zoom') ?? Q.get('cam');
const RETRY = 20000;
let cur = '', want = 'mac-dinh', lite = false, camZoom = false, first = true, busy = false, retryT = 0, n = 0;
const loaded = { 'mac-dinh': Promise.resolve() }, failAt = {};
export const isLite = () => lite;
export const isCamZoom = () => (forcedZoom !== null ? (forcedZoom === '1' || forcedZoom === 'true') : camZoom);
export const themeNow = () => cur;

export function applyLook(look = {}){
  want = THEMES.includes(forced) ? forced : THEMES.includes(look.theme) ? look.theme : 'mac-dinh';
  const wantLite = forcedLite !== null ? forcedLite === '1' : !!look.lite;
  if (wantLite !== lite) { lite = wantLite; document.body.classList.toggle('lite', lite); }
  if (look.camZoom !== undefined) camZoom = !!look.camZoom;
  // style bảng thống kê (cột phải + câu đố) chọn riêng; ?board=khung-vang để ép (xem thử)
  const board = new URLSearchParams(location.search).get('board') || look.board || 'theo-style';
  if (document.documentElement.dataset.board !== board) document.documentElement.dataset.board = board;
  document.body.classList.toggle('map3d', forced3d ? forced3d === '1' : !!look.map3d);
  go(false);
}

// nạp CSS + JS của style (một lần); lỗi → gỡ phần dở, lần sau thử lại với đường dẫn mới (trình duyệt nhớ import hỏng)
function loadStyle(t){
  if (loaded[t]) return loaded[t];
  const q = '?n=' + (++n);
  const css = new Promise((ok, no) => {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = `/style/${t}.css${q}`; l.dataset.style = t;
    l.onload = ok; l.onerror = () => no(new Error('thiếu ' + t + '.css')); document.head.appendChild(l);
  });
  const js = import(`/style/${t}.js${q}`).then(m => registerStyle(t, m.default));
  return loaded[t] = Promise.all([css, js]).catch(e => {
    delete loaded[t]; document.querySelectorAll(`link[data-style="${t}"]`).forEach(l => l.remove()); throw e;
  });
}

function go(retry){
  if (busy || want === cur) return;
  const t = want;
  if (!retry && Date.now() - (failAt[t] || 0) < RETRY) return;   // vừa hỏng → chờ hẹn giờ thử lại, không dồn yêu cầu
  busy = true;
  loadStyle(t).then(() => true, () => false).then(okLoad => {
    busy = false;
    if (!okLoad) { failAt[t] = Date.now(); clearTimeout(retryT); retryT = setTimeout(() => go(true), RETRY); }
    const show = okLoad ? t : cur || 'mac-dinh';
    if (show !== cur) swap(show);
    if (want !== t) go(false);   // đổi style tiếp trong lúc đang nạp
  });
}

function swap(t){
  if (first) { first = false; const h = document.documentElement; h.classList.add('noanim'); setTheme(t); setTimeout(() => h.classList.remove('noanim'), 100); return; }
  cur = t;   // chặn đổi trùng trong lúc phủ mờ
  const veil = $('#veil'); veil.classList.add('on');
  setTimeout(() => { setTheme(t); requestAnimationFrame(() => veil.classList.remove('on')); }, 380);
}

function setTheme(t){
  cur = t; document.documentElement.dataset.theme = t;
  const bg = $('#themeBg'); bg.innerHTML = '';   // hạt nền của style cũ bị gỡ theo
  setupThemeBg(t, bg);
}

/* ---------- không khí chung mọi style: sao lấp lánh + sao băng lúc rảnh + đom đóm / hoa đăng ---------- */
const rnd = (a, b) => a + Math.random() * (b - a);

// Đom đóm đêm / Hoa đăng nổi trên các tỉnh đã sáng
export function spawnLantern(prov, isLantern = false){
  const v = P[prov];
  if (!v) return;
  const marks = $('#marks');
  if (!marks) return;
  if (document.querySelectorAll('.hoa-dang').length > 30) return;

  const el = document.createElement('div');
  el.className = 'hoa-dang' + (isLantern ? ' lantern-shape' : '');
  const size = isLantern ? 14 : rnd(6, 11);
  const dur = rnd(3.2, 4.6);
  const dx1 = rnd(-16, 16);
  const dx2 = rnd(-26, 26);
  const dx3 = rnd(-36, 36);

  el.style.cssText = `left:${v.cx + rnd(-22, 22)}px;top:${v.cy + rnd(-16, 16)}px;width:${size}px;height:${size}px;--dur:${dur}s;--dx1:${dx1}px;--dx2:${dx2}px;--dx3:${dx3}px;`;
  marks.appendChild(el);
  setTimeout(() => el.remove(), dur * 1000 + 100);
}

// Lễ hội Thả Hoa Đăng khi cả nước rực sáng
export function launchLanternFestival(){
  const allProvs = Object.keys(P);
  allProvs.forEach((p, idx) => {
    setTimeout(() => {
      spawnLantern(p, true);
      setTimeout(() => spawnLantern(p, false), 350);
    }, idx * 100);
  });
}

function startFireflyAmbient(){
  const step = () => {
    if (!lite && !document.hidden) {
      const litKeys = Object.keys(P).filter(k => P[k]?.path?.classList.contains('on'));
      if (litKeys.length > 0) {
        const count = Math.min(litKeys.length >= 20 ? 3 : (litKeys.length >= 8 ? 2 : 1), litKeys.length);
        for (let i = 0; i < count; i++) {
          const prov = litKeys[Math.floor(Math.random() * litKeys.length)];
          const isLantern = Math.random() < 0.35;
          setTimeout(() => spawnLantern(prov, isLantern), i * 320);
        }
      }
    }
    setTimeout(step, rnd(1600, 2600));
  };
  setTimeout(step, 2000);
}

export function startAmbient(){
  const tw = $('#twinkle');
  for (let i = 0; i < 34; i++) {
    const d = document.createElement('i'), s = rnd(2, 5);
    d.style.cssText = `left:${rnd(0, 1080)}px;top:${rnd(0, 1920)}px;width:${s}px;height:${s}px;animation-delay:${rnd(0, 6).toFixed(2)}s;animation-duration:${rnd(3, 7).toFixed(2)}s`;
    tw.appendChild(d);
  }
  const meteor = () => {
    if (!lite && !document.hidden && (cur === 'mac-dinh' || cur === 'aurora' || cur === 'hoi-an')) {
      const m = document.createElement('i'); m.className = 'meteor';
      const x = rnd(200, 1100), y = rnd(-40, 700), len = rnd(500, 900);
      m.style.left = x + 'px'; m.style.top = y + 'px';
      $('#skyFx').appendChild(m);
      m.animate([{ transform: 'rotate(-35deg) translateX(0) scaleX(.2)', opacity: 0 }, { opacity: 1, offset: .15 }, { transform: `rotate(-35deg) translateX(-${len}px) scaleX(1)`, opacity: 0 }],
        { duration: rnd(1100, 1600), easing: 'cubic-bezier(.3,.6,.4,1)' }).onfinish = () => m.remove();
    }
    setTimeout(meteor, rnd(7000, 15000));
  };
  setTimeout(meteor, 4000);
  startFireflyAmbient();
}
