// ĐẠI CHIẾN ANH EM 3 MIỀN (BẮC - TRUNG - NAM)
// Nhận sự kiện thời gian thực qua JSON-RPC WebSocket, điều phối hoạt cảnh 3D, thanh giằng co và pháo hoa.

import { connectRpc } from './rpc-client.js';
import { initParticles, launchFirework, launchFireworkCluster, launchMassiveFireworks, screenShake } from './overlay/particles.js';
import { playSfx, MUTE } from './overlay/audio.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

// Tự động co giãn vừa khít màn hình trình duyệt / OBS
function fitStage(){
  const s = $('#stage');
  if (!s) return;
  const sw = window.innerWidth, sh = window.innerHeight;
  const k = Math.min(sw / 1080, sh / 1920);
  s.style.transform = `translate(-50%, -50%) scale(${k})`;
}
window.addEventListener('resize', fitStage);
fitStage();

// Khởi tạo hạt pháo hoa
initParticles($('#fxCanvas'));

// Quản lý âm thanh & cử chỉ chạm mở tiếng
const soundHint = $('#soundHint');
if (soundHint) {
  const unlockAudio = () => {
    playSfx('chime');
    soundHint.style.display = 'none';
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('click', unlockAudio);
  window.addEventListener('keydown', unlockAudio);
  if (!MUTE) soundHint.style.display = 'flex';
}

// Lưu trữ điểm hiển thị hiện tại để chạy tween mượt mà
const curScores = { bac: 0, trung: 0, nam: 0 };
const curPct = { bac: 33, trung: 33, nam: 34 };

function tweenScore(el, target, key){
  if (!el) return;
  const start = curScores[key] || 0;
  if (start === target) return;
  const dur = 400, startTime = performance.now();
  function step(t){
    const p = Math.min(1, (t - startTime) / dur);
    const val = Math.round(start + (target - start) * p);
    el.textContent = val.toLocaleString('vi-VN');
    if (p < 1) requestAnimationFrame(step);
    else curScores[key] = target;
  }
  requestAnimationFrame(step);
}

// Cập nhật bục Đại Tướng (Top 1)
function updateGeneral(genEl, donor, fallbackName){
  if (!genEl) return;
  const avEl = genEl.querySelector('.gen-av');
  const nameEl = genEl.querySelector('.gen-name');
  if (donor && donor.name) {
    nameEl.textContent = donor.name;
    if (donor.avatar) {
      avEl.style.backgroundImage = `url("${donor.avatar}")`;
      avEl.textContent = '';
    } else {
      avEl.style.backgroundImage = 'none';
      avEl.textContent = donor.name.slice(0, 1).toUpperCase();
    }
  } else {
    nameEl.textContent = fallbackName;
    avEl.style.backgroundImage = 'none';
    avEl.textContent = '★';
  }
}

// Hiệu ứng bục rung chuyển & bắn pháo hoa khi nhận điểm
function bumpPillar(regionCode, type, amount){
  const el = $(`#p${regionCode.charAt(0).toUpperCase() + regionCode.slice(1)}`);
  if (!el) return;

  el.style.transform = 'scale(1.08) translateZ(30px)';
  setTimeout(() => el.style.transform = '', 350);

  // Tọa độ bục trên khung 1080×1920
  const X_MAP = { bac: 195, trung: 540, nam: 885 };
  const COLOR_MAP = { bac: 'red', trung: 'gold', nam: 'cyan' };
  const x = X_MAP[regionCode] || 540;
  const y = regionCode === 'trung' ? 700 : 750;

  if (type === 'gift' || amount >= 30) {
    screenShake('sm');
    launchFireworkCluster(x, y - 100, 3, COLOR_MAP[regionCode]);
    playSfx('boom');
  } else {
    launchFirework(x, y - 50, COLOR_MAP[regionCode]);
  }
}

// Thêm thẻ nhật ký chiến trường thời gian thực
function addCombatCard(act){
  const feed = $('#liveStreamFeed');
  if (!feed) return;

  const card = document.createElement('div');
  card.className = `combat-card ${act.region}`;
  const icon = act.type === 'gift' ? '🎁' : act.type === 'follow' ? '➕' : act.type === 'like' ? '❤️' : '💬';
  const regNames = { bac: 'MIỀN BẮC', trung: 'MIỀN TRUNG', nam: 'MIỀN NAM' };
  const actionTxt = act.type === 'gift'
    ? `tặng <b>${esc(act.gift || 'Quà')}</b> (${act.coins} xu)`
    : act.type === 'follow' ? 'vừa <b>FOLLOW kênh</b>' : act.type === 'like' ? 'đã <b>thả tim</b>' : 'bình luận thắp đèn';

  card.innerHTML = `
    <span class="c-icon">${icon}</span>
    <div class="c-txt"><b>${esc(act.name || 'Người xem')}</b> ${actionTxt} cho <b>${regNames[act.region]}</b></div>
    <div class="c-pts">+${act.amount}đ</div>
  `;

  feed.appendChild(card);
  if (feed.children.length > 5) feed.removeChild(feed.children[0]);
}

// Vẽ trạng thái 3 Miền
function renderRegions(data){
  if (!data || !data.regions) return;
  const R = data.regions;

  // 1. Điểm số
  tweenScore($('#scoreBac'), R.bac?.pts || 0, 'bac');
  tweenScore($('#scoreTrung'), R.trung?.pts || 0, 'trung');
  tweenScore($('#scoreNam'), R.nam?.pts || 0, 'nam');

  // 2. Tỷ lệ % thanh giằng co
  const pb = R.bac?.pct ?? 33;
  const pt = R.trung?.pct ?? 33;
  const pn = R.nam?.pct ?? 34;

  const barBac = $('#barBac'), barTrung = $('#barTrung'), barNam = $('#barNam');
  if (barBac) barBac.style.width = pb + '%';
  if (barTrung) barTrung.style.width = pt + '%';
  if (barNam) barNam.style.width = pn + '%';

  $('#pctBac').textContent = pb + '%';
  $('#pctTrung').textContent = pt + '%';
  $('#pctNam').textContent = pn + '%';

  // Cập nhật vị trí clash points
  const cp1 = $('.tri-clash-point.cp1'), cp2 = $('.tri-clash-point.cp2');
  if (cp1) cp1.style.left = pb + '%';
  if (cp2) cp2.style.left = (pb + pt) + '%';

  // 3. Đại tướng từng miền
  updateGeneral($('#genBac'), R.bac?.topDonor, 'Chưa có Đại Tướng');
  updateGeneral($('#genTrung'), R.trung?.topDonor, 'Chưa có Đại Tướng');
  updateGeneral($('#genNam'), R.nam?.topDonor, 'Chưa có Đại Tướng');

  // 4. Bục nhận điểm
  if (data.act) {
    bumpPillar(data.act.region, data.act.type, data.act.amount);
    addCombatCard(data.act);
  }
}

// Lắng nghe sự kiện từ WebSocket RPC
const handlers = {
  regionsState: renderRegions,
  state: s => {
    if (s.regions) renderRegions({ regions: s.regions });
  }
};

let inFrame = false;
try { inFrame = window.top !== window; } catch { inFrame = true; }

const rpc = connectRpc({
  role: 'overlay',
  query: `sound=${MUTE ? 0 : 1}${inFrame ? '&src=xem-truoc' : ''}`,
  onEvent: m => handlers[m.t]?.(m)
});

// Yêu cầu nạp dữ liệu ban đầu
rpc.call('regions.get').then(renderRegions).catch(() => {});

