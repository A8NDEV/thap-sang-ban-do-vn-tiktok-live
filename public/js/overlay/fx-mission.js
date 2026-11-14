// Thẻ nhiệm vụ 60 giây: một thẻ dùng lại (không dựng lại mỗi lần nhận state), thanh tiến độ scaleX, đếm ngược.
// Chỉ animate transform + opacity (CSS transition). Chỉ có timer khi thẻ đang hiện.
import { $ } from './util.js';
import { isLite } from './theme.js';
import { qualityLevel } from './fx-perf.js';
import { banner } from './fx.js';
import { launchFireworkCluster } from './particles.js';
import { stagePt } from './theme-fx.js';

if (typeof document !== 'undefined' && !document.getElementById('fx-mission-css')) {
  const link = document.createElement('link');
  link.id = 'fx-mission-css';
  link.rel = 'stylesheet';
  link.href = new URL('../../css/fx-mission.css', import.meta.url).href;
  document.head?.appendChild(link);
}

const WIN_HOLD = 2500, END_HOLD = 2000;
const clip = (s) => Array.from(String(s ?? '')).slice(0, 28).join('');
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

let card = null, elK = null, elN = null, elT = null, elFill = null;
let shown = false, iv = null, holdT = null;
let receivedAt = 0, leftMs = 0;

function ensureCard() {
  if (card && card.isConnected) return card;
  const stage = $('#stage');
  if (!stage) return null;
  card = document.createElement('div');
  card.className = 'msn';
  elK = document.createElement('div'); elK.className = 'msn-k';
  const row = document.createElement('div'); row.className = 'msn-row';
  elN = document.createElement('span'); elN.className = 'msn-n';
  elT = document.createElement('span'); elT.className = 'msn-t';
  row.append(elN, elT);
  const bar = document.createElement('div'); bar.className = 'msn-bar';
  elFill = document.createElement('div'); elFill.className = 'msn-fill';
  bar.appendChild(elFill);
  card.append(elK, row, bar);
  stage.appendChild(card);
  return card;
}

function stopTimer() { if (iv !== null) { clearInterval(iv); iv = null; } }
function clearHold() { if (holdT !== null) { clearTimeout(holdT); holdT = null; } }

function hide() {
  clearHold();
  stopTimer();
  if (!shown) return;
  shown = false;
  card?.classList.remove('show');
}

function tickText() {
  try {
    const ms = Math.max(0, leftMs - (performance.now() - receivedAt));
    elT.textContent = `còn ${Math.ceil(ms / 1000)}s`;
  } catch { /* bỏ qua */ }
}

function setProgress(count, target) {
  const t = num(target), c = num(count);
  elN.textContent = `${c}/${t}`;
  const r = t > 0 ? Math.min(1, Math.max(0, c / t)) : 0;
  elFill.style.transform = `scaleX(${r})`;
}

function reveal() {
  shown = true;
  card.classList.add('show');
}

export function renderMission(view) {
  try {
    if (!view) {
      if (holdT === null) hide(); // đang giữ chữ thắng/thua thì để bộ đếm giờ tự ẩn
      return;
    }
    if (!ensureCard()) return;
    clearHold();
    card.classList.remove('won', 'lost');
    elK.textContent = clip(view.label) || 'Nhiệm vụ';
    setProgress(view.count, view.target);
    receivedAt = performance.now();
    leftMs = Math.max(0, num(view.leftMs));
    tickText();
    if (iv === null) iv = setInterval(tickText, 250);
    if (!shown) reveal();
  } catch { /* hiệu ứng phụ: không bao giờ làm hỏng luồng chính */ }
}

function holdThenHide(ms) {
  stopTimer();
  clearHold();
  reveal();
  holdT = setTimeout(() => {
    holdT = null;
    hide();
    card?.classList.remove('won', 'lost');
  }, ms);
}

export function missionWin(ev) {
  try {
    const m = ev || {};
    if (ensureCard()) {
      card.classList.remove('lost');
      card.classList.add('won');
      elK.textContent = '🎯 HOÀN THÀNH!';
      setProgress(m.target, m.target);
      elT.textContent = '';
      holdThenHide(WIN_HOLD);
    }
    const prov = clip(m.prov);
    try {
      banner(
        '🎯 NHIỆM VỤ HOÀN THÀNH',
        prov ? `QUÊ ${prov.toUpperCase()} THẮNG!` : 'CẢ PHÒNG CÙNG LÀM ĐƯỢC!',
        `${num(m.count)}/${num(m.target)} lượt bình luận`,
        5000,
      );
    } catch { /* bỏ qua */ }
    if (m.prov && !isLite() && qualityLevel() < 2) {
      try {
        const pt = stagePt(m.prov);
        if (pt) launchFireworkCluster(pt.x, Math.max(220, pt.y - 100), 4, 'gold');
      } catch { /* bỏ qua */ }
    }
  } catch { /* hiệu ứng phụ */ }
}

export function missionEnd(ev) {
  try {
    const m = ev || {};
    if (!ensureCard()) return;
    card.classList.remove('won');
    card.classList.add('lost');
    elK.textContent = 'Chưa đủ lần này';
    setProgress(m.count, m.target);
    elT.textContent = '';
    holdThenHide(END_HOLD);
  } catch { /* hiệu ứng phụ */ }
}
