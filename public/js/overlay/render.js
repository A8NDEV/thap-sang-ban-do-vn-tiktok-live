// Lớp Z-1/Z-5: vẽ trạng thái — tỉnh sáng, ảnh người thắp, thẻ "vừa thắp đèn", đua điểm, quà, bảng điểm, bục vinh danh.
import { $, esc, avatar, short, tweenNum, flipList } from './util.js';
import { applyLook } from './theme.js';
import { P, placeLabel } from './map.js';
import { playSfx } from './audio.js';

let state = null, clockOff = 0, hotT = null;
export const getState = () => state;

export function render(s){
  state = s; clockOff = s.round.now - Date.now(); applyLook(s.look);
  tweenNum($('#litN'), s.litCount); tweenNum($('#pplN'), s.people);
  $('#barIn').style.width = (s.litCount / s.total * 100) + '%';
  for (const [ten, v] of Object.entries(P)) {
    const L = s.lit[ten], on = !!L;
    if (on !== v.path.classList.contains('on')) { v.path.classList.toggle('on', on); v.label.classList.toggle('on', on); (on ? $('#litG') : $('#offG')).appendChild(v.path); }
    if (on) {
      if (!v.mk) { v.mk = document.createElement('div'); v.mk.className = 'mk ' + v.size; v.mk.innerHTML = '<div class="own"></div><div class="stack"></div><span class="medal"></span>'; v.mk.style.left = v.cx + 'px'; v.mk.style.top = (v.cy - 8) + 'px'; $('#marks').appendChild(v.mk); placeLabel(v, true); }
      const rec = (L.recent && L.recent.length ? L.recent : [L.last || L.by]).slice(0, v.size === 'lg' ? 3 : v.size === 'md' ? 2 : 1), key = rec.map(r => r.name + r.avatar).join('|');
      if (v.mk.dataset.who !== key) {
        v.mk.dataset.who = key; const st = v.mk.querySelector('.stack'); st.innerHTML = '';
        for (const r of rec) { const a = document.createElement('div'); a.className = 'av'; avatar(a, r.name, r.avatar); st.appendChild(a); }     // người mới nhất đứng trước, to nhất
      }
      // Chủ tỉnh: vương miện + ảnh người giữ ngôi phía trên tỉnh
      const o = s.owners?.[ten], okey = o ? o.name + o.avatar : '';
      if (v.mk.dataset.own !== okey) {
        v.mk.dataset.own = okey; const el = v.mk.querySelector('.own'); el.innerHTML = '';
        if (o) { el.innerHTML = '<span class="cr">👑</span>'; if (v.size !== 'sm') { const a = document.createElement('div'); a.className = 'av'; avatar(a, o.name, o.avatar); el.appendChild(a); } }
      }
    } else if (v.mk) { v.mk.remove(); v.mk = null; placeLabel(v, false); }
  }
  renderDuel(s.duel);
  renderQuiz(s.quiz, s.rules?.quizPts);
  renderChest(s.chest);
  if (s.regionsModalOpen !== undefined) setRegionsModal(s.regionsModalOpen);
  if (s.regions) renderRegions(s.regions);
  // 3 tỉnh dẫn đầu vòng đua: viền sáng nhịp thở + huy chương
  const rank = {}; s.round.top.slice(0, 3).forEach((x, i) => rank[x.prov] = i + 1);
  for (const [ten, v] of Object.entries(P)) {
    const r = s.lit[ten] ? rank[ten] : 0, cls = r ? 'r' + r : '';
    if (v.rank !== cls) { v.rank = cls; v.hl.setAttribute('class', 'hl ' + cls); }
    if (v.mk) { v.mk.classList.remove('r1', 'r2', 'r3'); if (r) { v.mk.classList.add(cls); v.mk.querySelector('.medal').textContent = ['🥇', '🥈', '🥉'][r - 1]; } }
  }
  // vừa thắp đèn / vừa tặng quà
  const last = s.last, b = $('#lastBody');
  if (last && b.dataset.k !== last.at + last.name) {
    b.dataset.k = last.at + last.name;
    const card = $('#lastCard'), h = card.querySelector('h3');
    if (last.kind === 'gift' || last.kind === 'full') {
      h.innerHTML = last.kind === 'full' ? 'CẢ NƯỚC RỰC SÁNG <small>🎆</small>' : 'VỪA TẶNG QUÀ <small>🎁</small>';
      b.innerHTML = `<div class="bigAv"></div><div class="nm"></div><div class="gf"></div><div class="qu"></div>`;
      b.querySelector('.gf').innerHTML = last.kind === 'full' ? `${last.coins} xu · <b>34/34 tỉnh</b>` : `${esc(last.gift)} · <b>+${last.pts}</b> điểm`;
      b.querySelector('.qu').textContent = last.prov ? 'cho quê ' + last.prov : last.kind === 'full' ? 'thắp sáng cả 34 tỉnh, thành!' : 'comment tên quê để nhận điểm!';
      card.classList.add('hot'); clearTimeout(hotT); hotT = setTimeout(() => card.classList.remove('hot'), 8000);
    } else {
      h.innerHTML = 'VỪA THẮP ĐÈN <small>🏮</small>';
      b.innerHTML = `<div class="bigAv"></div><div class="nm"></div><div class="qu"></div><div class="ft"></div>`;
      b.querySelector('.qu').textContent = (last.fresh ? '✨ thắp sáng ' : 'quê ') + last.prov;
      b.querySelector('.ft').textContent = last.fact;
    }
    avatar(b.querySelector('.bigAv'), last.name, last.avatar);
    b.querySelector('.nm').textContent = last.name;
    b.classList.remove('anim'); void b.offsetWidth; b.classList.add('anim');
  } else if (!last) { b.dataset.k = ''; b.innerHTML = '<div class="empty">Chưa có ai thắp đèn.<br>Comment tên quê bạn để là người đầu tiên!</div>'; }
  // đua thắp đèn
  const top = s.round.top, max = Math.max(1, ...top.map(x => x.pts));
  flipList($('#race'), top.length ? top.map((x, i) => `<div class="row" data-id="${esc(x.prov)}"><div class="fill" style="width:${x.pts / max * 100}%"></div><div class="rk">${i + 1}</div><div class="pn">${esc(short(x.prov))}${s.wins[x.prov] ? `<small>🏆${s.wins[x.prov]}</small>` : ''}</div><div class="pt">${x.pts}</div></div>`).join('')
    : `<div class="empty">Vòng đua bắt đầu khi có người thắp đèn.<br>Comment, tặng quà để cộng điểm cho quê!</div>`);
  // quà
  const g = s.gifts, gm = Math.max(1, ...g.map(x => x.coins));
  flipList($('#gifts'), g.length ? g.map((x, i) => `<div class="row" data-id="${esc(x.prov)}"><div class="fill" style="width:${x.coins / gm * 100}%"></div><div class="rk">${i + 1}</div><div class="pn">${esc(short(x.prov))}</div><div class="pt">${x.coins}</div></div>`).join('')
    : `<div class="empty">Chưa có quà.<br>Tặng quà để quê bạn lên bảng nhé 🎁</div>`);
  // bảng điểm (bậc quà)
  const r = s.rules, T = r.tiers || [];
  const range = i => T[i + 1] ? (T[i + 1][0] - 1 > T[i][0] ? `${T[i][0]}–${T[i + 1][0] - 1} xu` : `${T[i][0]} xu`) : `từ ${T[i][0]} xu`;
  const fmt = n => n.toLocaleString('vi-VN');
  $('#how').innerHTML = `<div class="tier"><span>💬 Mỗi comment</span><b>+${r.commentPts}</b></div>`
    + (r.likePts ? `<div class="tier"><span>❤️ Mỗi tim</span><b>+${r.likePts}</b></div>` : '')
    + (r.followPts ? `<div class="tier"><span>➕ Mỗi follow</span><b>+${r.followPts}</b></div>` : '')
    + T.slice(0, (r.likePts && r.followPts) ? 2 : (r.likePts || r.followPts) ? 3 : 4).map(([, p], i) => `<div class="tier"><span>🎁 ${range(i)}</span><b>+${fmt(p)}</b></div>`).join('')
    + (r.fullCoins ? `<div class="tier full"><span>🎆 ${fmt(r.fullCoins)} xu</span><b>CẢ NƯỚC RỰC SÁNG</b></div>` : '');
  // thực đơn quà (giống Sàn Quẩy): hình quà + hành động — thẻ này luân phiên với bảng điểm
  menu = s.menu || [];
  $('#gmenu').innerHTML = menu.map(m => `<div class="gm"><img src="${esc(m.img)}" alt="" referrerpolicy="no-referrer"><span><b>${esc(m.gift)} <small>${m.coins} xu</small></b><em>${m.emoji} ${esc(m.label)}</em></span></div>`).join('');
  if (!menu.length) showHow(true);
  // vinh danh người tặng nhiều
  const d = s.donors || [], order = [1, 0, 2];
  $('#podBars').innerHTML = d.length ? order.filter(i => d[i]).map(i => `<div class="pd p${i + 1}"><div class="pav" data-i="${i}"></div><div class="blk">${['🥇', '🥈', '🥉'][i]} ${d[i].coins}<small style="font-size:14px">xu</small></div><div class="pnm"></div></div>`).join('') : '<div class="empty" style="margin:auto">Tặng quà để được vinh danh ở đây 🎁</div>';
  for (const el of $('#podBars').querySelectorAll('.pav')) { const x = d[+el.dataset.i]; avatar(el, x.name, x.avatar); el.parentElement.querySelector('.pnm').textContent = x.name; }
}

export function clearMarks(){ for (const v of Object.values(P)) { v.mk?.remove(); v.mk = null; } }

// đồng hồ đếm ngược vòng đua (theo giờ máy chủ)
export function startCountdown(){
  setInterval(() => {
    if (!state) return;
    const end = state.round.endsAt, cd = $('#cd');
    if (!end) { $('#cdWrap').style.visibility = 'hidden'; return; }
    $('#cdWrap').style.visibility = '';
    const left = Math.max(0, Math.round((end - Date.now() - clockOff) / 1000));
    cd.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    cd.classList.toggle('hot', left <= 30);
  }, 250);
}

/* ---------- Câu đố: hộp góc trái ---------- */
let quizKey = '';
function renderQuiz(q, pts){
  const box = $('#quizCard');
  box.classList.toggle('show', !!q);
  if (!q) { quizKey = ''; return; }
  if (q.q !== quizKey) { quizKey = q.q; $('#qzQ').textContent = q.q; popQuiz(); }
  $('#qzN').textContent = `${q.n} đúng`;
  const f = $('#qzFoot');
  f.classList.toggle('ans', !!q.done);
  if (q.done) f.textContent = `✅ Đáp án: ${q.answer}`;
  else if (q.first) f.innerHTML = `<b>+${q.first.pts}</b>${esc(q.first.name)}${q.first.prov ? ' · ' + esc(short(q.first.prov)) : ''}`;
  else f.textContent = `💬 Comment đáp án · nhanh nhất +${pts ?? 10}`;
}
export function popQuiz(){ const b = $('#quizCard'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
export function startQuizClock(){
  setInterval(() => {
    const q = state?.quiz; if (!q) return;
    const el = $('#qzCd');
    if (q.done) { el.textContent = 'hết giờ'; el.classList.remove('hot'); return; }
    const left = Math.max(0, Math.min(q.sec, Math.round((q.endsAt - Date.now() - clockOff) / 1000)));
    el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; el.classList.toggle('hot', left <= 10);
  }, 250);
}

/* ---------- Đại chiến: thanh kéo co, tia năng lượng & báo động đỏ ---------- */
let duelKey = '', lastSa = -1, lastSb = -1, duelTagA = null, duelTagB = null, lastAlertSec = -1;

function clearDuelVisuals(){
  if (duelTagA) { duelTagA.remove(); duelTagA = null; }
  if (duelTagB) { duelTagB.remove(); duelTagB = null; }
  const duelG = $('#duelG');
  if (duelG) duelG.innerHTML = '';
  $('#stage')?.classList.remove('red-alert');
  $('#duel')?.classList.remove('red-alert');
}

function renderDuel(d){
  const box = $('#duel'), key = d ? d.a + '|' + d.b : '';
  if (!d) {
    box.classList.remove('show');
    clearDuelVisuals();
    lastSa = lastSb = -1;
    if (duelKey) {
      for (const v of Object.values(P)) v.path.classList.remove('duelA', 'duelB');
      duelKey = '';
    }
    return;
  }

  if (key !== duelKey) {
    for (const v of Object.values(P)) v.path.classList.remove('duelA', 'duelB');
    P[d.a]?.path.classList.add('duelA');
    P[d.b]?.path.classList.add('duelB');
    $('#duelA').textContent = short(d.a);
    $('#duelB').textContent = short(d.b);
    duelKey = key;
  }
  box.classList.add('show');

  // Điểm số pop nảy khi có điểm mới
  const elSa = $('#duelSa'), elSb = $('#duelSb');
  if (lastSa !== -1 && d.sa > lastSa) { elSa.classList.remove('pop'); void elSa.offsetWidth; elSa.classList.add('pop'); playSfx('clash'); }
  if (lastSb !== -1 && d.sb > lastSb) { elSb.classList.remove('pop'); void elSb.offsetWidth; elSb.classList.add('pop'); playSfx('clash'); }
  lastSa = d.sa; lastSb = d.sb;
  elSa.textContent = d.sa; elSb.textContent = d.sb;

  $('#duelHint').innerHTML = `💬 bình luận +${d.cp ?? 5} · ❤️ tim +${d.lp ?? 1} · <span class="hot-follow">➕ follow +${d.fp ?? 25}</span> cho quê mình`;
  const pa = d.sa + d.sb ? Math.max(10, Math.min(90, d.sa / (d.sa + d.sb) * 100)) : 50;
  $('#ropeA').style.width = pa + '%'; $('#ropeB').style.width = (100 - pa) + '%';

  // Vẽ tia năng lượng va chạm giữa 2 tỉnh trên bản đồ SVG
  const va = P[d.a], vb = P[d.b];
  if (va && vb) {
    const k = pa / 100;
    const cx = va.cx + (vb.cx - va.cx) * k;
    const cy = va.cy + (vb.cy - va.cy) * k;
    const duelG = $('#duelG');
    if (duelG) {
      duelG.innerHTML = `
        <line class="duel-beam duel-beam-a" x1="${va.cx}" y1="${va.cy}" x2="${cx}" y2="${cy}"/>
        <line class="duel-beam duel-beam-b" x1="${vb.cx}" y1="${vb.cy}" x2="${cx}" y2="${cy}"/>
        <circle class="duel-clash-ring" cx="${cx}" cy="${cy}"/>
        <circle class="duel-clash-core" cx="${cx}" cy="${cy}" r="14"/>
      `;
    }

    // Thẻ tên đội nổi trên đỉnh tỉnh
    if (!duelTagA) { duelTagA = document.createElement('div'); duelTagA.className = 'duel-tag red'; $('#marks').appendChild(duelTagA); }
    if (!duelTagB) { duelTagB = document.createElement('div'); duelTagB.className = 'duel-tag blue'; $('#marks').appendChild(duelTagB); }
    duelTagA.textContent = `🔴 ĐỘI ${short(d.a)}`;
    duelTagA.style.left = va.cx + 'px'; duelTagA.style.top = (va.cy - 48) + 'px';
    duelTagB.textContent = `🔵 ĐỘI ${short(d.b)}`;
    duelTagB.style.left = vb.cx + 'px'; duelTagB.style.top = (vb.cy - 48) + 'px';
  }
}

export function startDuelClock(){
  setInterval(() => {
    const d = state?.duel;
    const el = $('#duelCd');
    if (!d || !d.endsAt) {
      $('#stage')?.classList.remove('red-alert');
      $('#duel')?.classList.remove('red-alert');
      lastAlertSec = -1;
      return;
    }
    const left = Math.max(0, Math.round((d.endsAt - Date.now() - clockOff) / 1000));
    el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    el.classList.toggle('hot', left <= 15);

    // Báo động đỏ 10 giây cuối cùng
    const isAlert = left <= 10 && left > 0;
    $('#stage')?.classList.toggle('red-alert', isAlert);
    $('#duel')?.classList.toggle('red-alert', isAlert);

    if (isAlert && lastAlertSec !== left) {
      lastAlertSec = left;
      playSfx('alert', left);
    }
    if (!isAlert) lastAlertSec = -1;
  }, 250);
}

/* ---------- Rương Vàng May Mắn ---------- */
export function renderChest(c){
  const el = $('#chestWrap');
  if (!el) return;
  if (!c) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const provEl = $('#chestProv');
  if (provEl) provEl.textContent = c.prov;
  const bonusEl = $('#chestBonusTag');
  if (bonusEl) bonusEl.textContent = `+${Number(c.bonusPts || 3000).toLocaleString('vi-VN')}đ`;

  const pct = c.pct !== undefined ? c.pct : Math.min(100, Math.round(((c.energy || 0) / (c.maxEnergy || 35)) * 100));
  const barIn = $('#chestBarIn');
  if (barIn) barIn.style.width = pct + '%';
  const txtEl = $('#chestEnergyTxt');
  if (txtEl) txtEl.textContent = `${c.energy || 0}/${c.maxEnergy || 35} Năng Lượng (${pct}%)`;
}

export function startChestClock(){
  setInterval(() => {
    const c = state?.chest;
    const cdEl = $('#chestCd');
    if (!c || !c.endsAt || !cdEl) return;
    const left = Math.max(0, Math.round((c.endsAt - Date.now() - clockOff) / 1000));
    cdEl.textContent = `còn ${left}s`;
    if (left <= 10) cdEl.style.color = '#ff1744';
    else cdEl.style.color = '#ff5252';
  }, 250);
}

// thẻ góc phải dưới: "Bảng điểm" ↔ "Tặng quà này để…" đổi nhau mỗi 8 giây (chỉ khi có thực đơn quà)
let menu = [], howOn = true;
function showHow(on){ howOn = on; $('#how').hidden = !on; $('#gmenu').hidden = on; $('#howTitle').textContent = on ? 'BẢNG ĐIỂM THẮP ĐÈN' : 'TẶNG QUÀ NÀY ĐỂ…'; }
export function startHowRotate(){ setInterval(() => showHow(menu.length ? !howOn : true), 8000); }

/* ---------- ĐẠI CHIẾN ANH EM 3 MIỀN (POPUP MODAL & 3D BATTLE) ---------- */
export function setRegionsModal(open){
  const el = $('#regionsModal');
  if (!el) return;
  const wasHidden = el.hidden;
  el.hidden = !open;
  if (open && wasHidden) {
    playSfx('fanfare');
  }
}

export function renderRegions(regions){
  if (!regions) return;
  const { bac, trung, nam } = regions;
  if (!bac || !trung || !nam) return;

  // 1. Cập nhật thanh giằng co tam đấu
  const barB = $('#rmBarBac'), barT = $('#rmBarTrung'), barN = $('#rmBarNam');
  if (barB) barB.style.width = bac.pct + '%';
  if (barT) barT.style.width = trung.pct + '%';
  if (barN) barN.style.width = nam.pct + '%';

  const pctB = $('#rmPctBac'), pctT = $('#rmPctTrung'), pctN = $('#rmPctNam');
  if (pctB) pctB.textContent = bac.pct + '%';
  if (pctT) pctT.textContent = trung.pct + '%';
  if (pctN) pctN.textContent = nam.pct + '%';

  const cl1 = $('#rmClash1'), cl2 = $('#rmClash2');
  if (cl1) cl1.style.left = bac.pct + '%';
  if (cl2) cl2.style.left = (bac.pct + trung.pct) + '%';

  // 2. Điểm số các miền
  tweenNum($('#rmScoreBac'), bac.pts);
  tweenNum($('#rmScoreTrung'), trung.pts);
  tweenNum($('#rmScoreNam'), nam.pts);

  // 3. Đại tướng từng miền
  renderRegionGeneral('Bac', bac.topDonor);
  renderRegionGeneral('Trung', trung.topDonor);
  renderRegionGeneral('Nam', nam.topDonor);
}

function renderRegionGeneral(key, donor){
  const gEl = $(`#rmGen${key}`);
  if (!gEl) return;
  const nameEl = gEl.querySelector('.rm-gname');
  const avEl = gEl.querySelector('.rm-gav');
  if (donor && donor.pts > 0) {
    if (nameEl) nameEl.textContent = `${donor.name} (${Number(donor.pts).toLocaleString('vi-VN')}đ)`;
    if (avEl) avatar(avEl, donor.name, donor.avatar);
  } else {
    if (nameEl) nameEl.textContent = 'Chưa có Đại Tướng';
    if (avEl) { avEl.innerHTML = ''; avEl.style.backgroundImage = 'none'; }
  }
}

export function pushRegionsCombatFeed(act){
  const feed = $('#rmFeed');
  if (!feed || !act) return;

  const item = document.createElement('div');
  item.className = `rm-fitem ${act.region || 'bac'}`;
  
  let ico = '⚔️';
  let desc = '';
  if (act.type === 'gift') {
    ico = '🎁';
    desc = `tặng <b>${act.gift || 'quà'}</b> (+${Number(act.amount).toLocaleString('vi-VN')}đ)`;
  } else if (act.type === 'follow') {
    ico = '➕';
    desc = `đã <b>Follow kênh</b> (+${act.amount}đ)`;
  } else if (act.type === 'like') {
    ico = '❤️';
    desc = `thả tim (+${act.amount}đ)`;
  } else {
    ico = '💬';
    desc = `bình luận (+${act.amount}đ)`;
  }

  const regName = act.region === 'bac' ? 'Miền Bắc' : act.region === 'trung' ? 'Miền Trung' : 'Miền Nam';
  item.innerHTML = `
    <span class="fi-ico">${ico}</span>
    <span class="fi-txt"><b>${esc(act.name || 'Người xem')}</b> ${desc} cho ${regName}</span>
    <span class="fi-pts">+${Number(act.amount).toLocaleString('vi-VN')}</span>
  `;

  feed.appendChild(item);
  while (feed.children.length > 3) {
    feed.removeChild(feed.firstChild);
  }
}
