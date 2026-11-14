// Lớp Z-3/Z-4: hiệu ứng (gợn sóng, +điểm, nháy tỉnh, thông báo lớn) và camera lia tới tỉnh.
// Mọi phần tử hiệu ứng tự xóa khỏi DOM khi hết vòng đời → chạy 24/7 không phình bộ nhớ.
import { $, avatar } from './util.js';
import { P } from './map.js';
import { getState } from './render.js';
import { isLite, launchLanternFestival } from './theme.js';
import { stagePt, cardPt, themeTravel, themeArrive, themeNation } from './theme-fx.js';
import { launchFirework, launchFireworkCluster, launchMassiveFireworks, screenShake, dragonSparkles } from './particles.js';

function addFx(cls, ten, txt, life, dy = 0){
  const v = P[ten]; if (!v) return;
  const e = document.createElement('div'); e.className = cls; if (txt) e.textContent = txt;
  e.style.left = v.cx + 'px'; e.style.top = (v.cy + dy) + 'px';
  $('#marks').appendChild(e); setTimeout(() => e.remove(), life); return e;
}
export function ripple(ten, n = 1){ for (let k = 0; k < n; k++) setTimeout(() => addFx('ripple', ten, '', 1700), k * 350); }
const plus = (ten, txt) => addFx('plus', ten, txt, 2300, -30);
export function flash(ten, cls = 'blink'){ const v = P[ten]; if (!v) return; v.path.classList.remove(cls); void v.path.getBBox(); v.path.classList.add(cls); setTimeout(() => v.path.classList.remove(cls), cls === 'win' ? 5600 : 2400); }

let bannerT = null;
export function banner(k, v, s, ms = 6000, who){
  const b = $('#banner'); b.querySelector('.k').textContent = k; b.querySelector('.v').textContent = v; b.querySelector('.s').textContent = s;
  b.classList.toggle('withav', !!who); if (who) avatar(b.querySelector('.bav'), who.name, who.avatar);
  b.classList.add('show'); clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('show'), ms);
}
const islT = {};
export function island(k){ const el = $(k === 'hs' ? '#islHS' : '#islTS'); el.classList.add('glow'); clearTimeout(islT[k]); islT[k] = setTimeout(() => el.classList.remove('glow'), 6000); }

/* ---------- camera: lia tới tỉnh vừa thắp đèn / tặng quà, nháy sáng, rồi lùi lại ---------- */
const BOX = { w: 738, h: 1552, top: 232 };
const camQ = []; let camBusy = false, camHome = null, tourT = null, tourI = 0;
function camTo(x, y, k, idle = false){
  const cam = $('#cam');
  cam.classList.toggle('idle', idle);
  if (k === 1) { cam.style.transform = ''; return; }
  let tx = BOX.w / 2 - k * x, ty = BOX.top + BOX.h / 2 - k * y;
  tx = Math.min(0, Math.max(BOX.w - 740 * k, tx));                                 // không lia ra ngoài vùng bản đồ
  ty = Math.min(BOX.top - 240 * k, Math.max(BOX.top + BOX.h - 1790 * k, ty));
  cam.style.transform = `translate(${tx}px,${ty}px) scale(${k})`;
}
// lúc rảnh: camera tự bay chậm khắp Việt Nam (toàn cảnh → Bắc → Trung → Nam → tỉnh dẫn đầu → tỉnh vừa sáng…)
const TOUR = [() => [0, 0, 1], () => [330, 470, 1.55], () => [420, 760, 1.35], () => [560, 1080, 1.5], () => [560, 1350, 1.45], () => [420, 1560, 1.6], () => [0, 0, 1],
  () => { const t = getState()?.round.top[0]?.prov; return t && P[t] ? [P[t].cx, P[t].cy, 1.9] : [370, 1000, 1.15]; },
  () => [360, 900, 1.12],
  () => { const s = getState(), L = s ? Object.entries(s.lit).sort((a, b) => b[1].at - a[1].at)[0] : null; return L && P[L[0]] ? [P[L[0]].cx, P[L[0]].cy, 1.8] : [480, 1450, 1.4]; }];
function tour(){
  clearTimeout(tourT);
  if (camBusy) return;
  const [x, y, k] = TOUR[tourI++ % TOUR.length]();
  camTo(x, y, k, true);
  tourT = setTimeout(tour, 8000);
}
export function startTour(){ setTimeout(tour, 1500); }
export function shot(ev){ if (camQ.length >= 6) camQ.splice(0, camQ.length - 5); camQ.push(ev); if (!camBusy) nextShot(); }
function nextShot(){
  const ev = camQ.shift();
  if (!ev) { camBusy = false; clearTimeout(camHome); camHome = setTimeout(tour, 600); return; }
  camBusy = true; clearTimeout(camHome); clearTimeout(tourT);
  const v = P[ev.prov]; if (!v) return nextShot();
  const k = v.size === 'sm' ? 3 : v.size === 'md' ? 2.5 : 2.1;
  camTo(v.cx, v.cy, ev.hold ? Math.min(3.6, k * 1.3) : k);   // quà "Camera": lia sát hơn, giữ lâu hơn
  const hold = ev.hold || (camQ.length > 2 ? 1700 : 2600);
  const useComet = ev.comet && !isLite(), fly = useComet ? 620 : 0;
  if (useComet) setTimeout(() => { const to = stagePt(ev.prov), from = cardPt(); if (to && from) themeTravel(from, to); }, 750);
  setTimeout(() => {
    flash(ev.prov); themeArrive(ev.prov, ev.big); addFx('focus', ev.prov, '', 2500); ripple(ev.prov, ev.big ? 3 : 2);
    addFx('camTag', ev.prov, ev.tag, 2700, -44);
    if (ev.plus) plus(ev.prov, ev.plus);
    ev.fx?.();
    const m = P[ev.prov].mk; if (m) { m.classList.remove('pop'); void m.offsetWidth; m.classList.add('pop'); }
  }, 750 + fly);
  setTimeout(nextShot, 750 + fly + hold);
}
// cả nước rực sáng: camera lùi toàn cảnh, đèn sáng lan từ Bắc vào Nam 3 lượt
export function nationWide(){
  camQ.length = 0; clearTimeout(tourT); camTo(0, 0, 1); clearTimeout(camHome); camHome = setTimeout(tour, 11000);
  themeNation();
  launchLanternFestival();
  launchMassiveFireworks();
  screenShake('lg');
  const order = Object.keys(P).sort((a, b) => P[a].cy - P[b].cy);
  for (let rep = 0; rep < 3; rep++) order.forEach((t, i) => setTimeout(() => { flash(t); if (rep === 0) ripple(t); }, rep * 3500 + i * 70));
}

/* ---------- hiệu ứng riêng theo loại quà ---------- */
const rnd = (a, b) => a + Math.random() * (b - a);
function spawn(ten, ch, n, cls, life, spread = 45){
  const v = P[ten]; if (!v) return;
  for (let i = 0; i < n; i++) {
    const e = document.createElement('div'); e.className = 'gp ' + cls; e.textContent = ch;
    if (cls === 'burst') { const ang = (i / n) * Math.PI * 2 + rnd(-.2, .2), r = rnd(spread * 1.4, spread * 2.6); e.style.setProperty('--dx', Math.cos(ang) * r + 'px'); e.style.setProperty('--dy', Math.sin(ang) * r + 'px'); e.style.left = v.cx + 'px'; e.style.top = v.cy + 'px'; }
    else { e.style.setProperty('--dx', rnd(-spread, spread) + 'px'); e.style.left = v.cx + rnd(-spread, spread) + 'px'; e.style.top = v.cy + rnd(-20, 10) + 'px'; }
    e.style.animationDelay = rnd(0, cls === 'burst' ? .1 : .7) + 's';
    $('#marks').appendChild(e); setTimeout(() => e.remove(), life + 900);
  }
}
function pop(ten, ch, n = 3){ const v = P[ten]; if (!v) return; for (let i = 0; i < n; i++) setTimeout(() => { const e = document.createElement('div'); e.className = 'gp pop'; e.textContent = ch; e.style.left = v.cx + rnd(-40, 40) + 'px'; e.style.top = v.cy + rnd(-40, 20) + 'px'; $('#marks').appendChild(e); setTimeout(() => e.remove(), 1800); }, i * 380); }

// rồng vàng bay dọc bản đồ + pháo hoa khắp màn hình (quà lớn)
export function dragon(){
  const sky = $('#skyFx');
  const d = document.createElement('div'); d.className = 'dragon'; d.textContent = '🐉'; sky.appendChild(d); setTimeout(() => d.remove(), 4800);
  screenShake('lg');
  for (let i = 0; i < 18; i++) {
    setTimeout(() => {
      const rect = d.getBoundingClientRect();
      const st = $('#stage').getBoundingClientRect();
      const k = st.width / 1080;
      const x = (rect.left + rect.width / 2 - st.left) / k;
      const y = (rect.top + rect.height / 2 - st.top) / k;
      if (x > 0 && y > 0) dragonSparkles(x, y, 7);
    }, i * 240);
  }
  for (let i = 0; i < 14; i++) setTimeout(() => { const e = document.createElement('div'); e.className = 'spark'; e.textContent = ['🎆', '🎇', '✨'][i % 3]; e.style.left = rnd(40, 1000) + 'px'; e.style.top = rnd(260, 1500) + 'px'; sky.appendChild(e); setTimeout(() => e.remove(), 1500); }, 300 + i * 260);
}

// mưa pháo hoa trên nhiều tỉnh đang sáng đèn
export function mapFireworks(){
  launchMassiveFireworks();
  screenShake('sm');
  const lit = Object.keys(getState()?.lit || {}), all = Object.keys(P), pool = (lit.length >= 4 ? lit : all).sort(() => Math.random() - .5).slice(0, 12);
  pool.forEach((t, i) => setTimeout(() => { spawn(t, '✨', 10, 'burst', 1400, 40); pop(t, '🎆', 1); flash(t); }, i * 220));
}

// act: hành động chủ kênh gán cho quà (Sàn Quẩy-style); không gán thì hiệu ứng theo mức xu
export function giftFx(prov, gift, coins, act = ''){
  if (act === 'rong') dragon();
  if (act === 'phaohoa') mapFireworks();
  if (act === 'hoahong' && P[prov]) return spawn(prov, '🌹', 26, 'fall', 2600);
  if (act === 'tim' && P[prov]) { spawn(prov, '💛', 22, 'burst', 1500, 55); spawn(prov, '💖', 12, 'rise', 2200); return; }
  if (act && act !== 'camera') return;
  if (coins >= 100) dragon();
  if (!prov || !P[prov]) return;

  // Cột sáng hoàng kim & Sóng xung kích khi tặng quà từ 10 xu trở lên
  if (coins >= 10) {
    addFx('lightPillar', prov, '', 2200);
    addFx('shockwave', prov, '', 1900);
    addFx('shockwave wave2', prov, '', 2200);
  } else if (coins >= 5) {
    addFx('shockwave', prov, '', 1600);
  }

  // Chùm pháo hoa bung toả trên tỉnh
  if (coins >= 30) {
    const pt = stagePt(prov);
    if (pt) launchFireworkCluster(pt.x, Math.max(220, pt.y - 120), coins >= 100 ? 5 : 3, coins >= 100 ? 'royal' : 'gold');
  }

  if (/hoa hồng|rose/i.test(gift)) spawn(prov, '🌹', coins >= 5 ? 24 : 14, 'fall', 2600);
  else if (coins >= 100) { spawn(prov, '✨', 24, 'burst', 1500, 65); pop(prov, '🎆', 4); }
  else if (coins >= 30) { spawn(prov, '✨', 18, 'burst', 1500, 50); pop(prov, '🎆', 3); }
  else if (coins >= 5) { spawn(prov, '💛', 14, 'burst', 1500, 40); spawn(prov, '✨', 8, 'rise', 2200); }
  else spawn(prov, '❤️', 12, 'rise', 2200);
}

export function duelWin(ten){
  if (!P[ten]) return;
  spawn(ten, '✨', 20, 'burst', 1500, 55); pop(ten, '🏆', 1); pop(ten, '🎆', 3);
  const pt = stagePt(ten);
  if (pt) launchFireworkCluster(pt.x, Math.max(220, pt.y - 100), 4, 'fire');
  screenShake('sm');
}

export function usurpCrown(prov, newOwner, prevOwner){
  const v = P[prov];
  if (!v) return;

  // 1. Chớp sáng hoàng kim & Rung chấn
  const veil = $('#veil');
  if (veil) {
    veil.classList.remove('gold-flash');
    void veil.offsetWidth;
    veil.classList.add('gold-flash');
    setTimeout(() => veil.classList.remove('gold-flash'), 550);
  }
  screenShake('lg');

  // 2. Tia sét giáng xuống tâm tỉnh
  const bolt = document.createElement('div');
  bolt.className = 'lightning-bolt';
  bolt.style.left = v.cx + 'px';
  bolt.style.top = (v.cy - 10) + 'px';
  $('#marks').appendChild(bolt);
  setTimeout(() => bolt.remove(), 700);

  // 3. Nếu có chủ tỉnh cũ: vương miện cũ nổ tung thành mảnh vỡ
  if (prevOwner) {
    for (let i = 0; i < 14; i++) {
      const shard = document.createElement('div');
      shard.className = 'crown-shard';
      const ang = (i / 14) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const dist = 50 + Math.random() * 80;
      shard.style.setProperty('--sx', Math.cos(ang) * dist + 'px');
      shard.style.setProperty('--sy', Math.sin(ang) * dist + 'px');
      shard.style.setProperty('--sr', (Math.random() * 720 - 360) + 'deg');
      shard.style.left = v.cx + 'px';
      shard.style.top = (v.cy - 40) + 'px';
      $('#marks').appendChild(shard);
      setTimeout(() => shard.remove(), 850);
    }
  }

  // 4. Vương miện mới rơi từ trời xuống
  const crown = document.createElement('div');
  crown.className = 'crown-drop';
  crown.textContent = '👑';
  crown.style.left = v.cx + 'px';
  crown.style.top = (v.cy - 36) + 'px';
  $('#marks').appendChild(crown);
  setTimeout(() => crown.remove(), 2600);

  // 5. Sóng xung kích & Chùm pháo hoa hoàng gia
  setTimeout(() => {
    addFx('shockwave', prov, '', 1900);
    addFx('shockwave wave2', prov, '', 2200);
    const pt = stagePt(prov);
    if (pt) launchFireworkCluster(pt.x, Math.max(220, pt.y - 100), 4, 'gold');
  }, 420);

  // 6. Tỉnh phát quang thống trị trong 14s
  v.path?.classList.add('crowned');
  setTimeout(() => {
    v.path?.classList.remove('crowned');
  }, 14000);
}

/* ---------- Hiệu ứng Rương Vàng May Mắn (Lucky Golden Chest) ---------- */
let activeChestPin = null;
let activeChestBeam = null;

export function spawnCoinRain(count = 45){
  const stage = $('#stage');
  if (!stage) return;
  const ICONS = ['🪙', '💰', '💎', '✨', '⭐', '🪙'];
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'coin-drop';
      el.textContent = ICONS[Math.floor(Math.random() * ICONS.length)];
      const x0 = rnd(30, 1050);
      const x1 = x0 + rnd(-120, 120);
      const dur = rnd(2.0, 3.4);
      const size = rnd(24, 38);
      const rot = rnd(180, 720);
      el.style.cssText = `
        --cx0:${x0}px;
        --cx1:${x1}px;
        --cdur:${dur}s;
        --cs:${size}px;
        --crot:${rot}deg;
      `;
      stage.appendChild(el);
      setTimeout(() => el.remove(), dur * 1000 + 100);
    }, i * 70);
  }
}

export function dropChestPin(prov){
  removeChestPin();
  const v = P[prov];
  if (!v) return;

  // Cột sáng vàng kim
  activeChestBeam = document.createElement('div');
  activeChestBeam.className = 'chest-light-beam';
  activeChestBeam.style.left = v.cx + 'px';
  activeChestBeam.style.top = (v.cy - 10) + 'px';
  $('#marks')?.appendChild(activeChestBeam);

  // Pin Rương thần kỳ bay bổng
  activeChestPin = document.createElement('div');
  activeChestPin.className = 'chest-pin';
  activeChestPin.textContent = '🎁';
  activeChestPin.style.left = v.cx + 'px';
  activeChestPin.style.top = (v.cy - 35) + 'px';
  $('#marks')?.appendChild(activeChestPin);
}

export function removeChestPin(){
  if (activeChestPin) { activeChestPin.remove(); activeChestPin = null; }
  if (activeChestBeam) { activeChestBeam.remove(); activeChestBeam = null; }
}

export function explodeChestFx(prov, bonusPts, topName){
  removeChestPin();
  screenShake('lg');
  launchMassiveFireworks();
  spawnCoinRain(50);

  if (prov && P[prov]) {
    addFx('shockwave', prov, '', 2000);
    addFx('shockwave wave2', prov, '', 2400);
    flash(prov, 'win');
    const pt = stagePt(prov);
    if (pt) launchFireworkCluster(pt.x, Math.max(200, pt.y - 120), 5, 'gold');
  }
}

