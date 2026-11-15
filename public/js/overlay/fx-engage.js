// Tương tác cả phòng: thanh mục tiêu tim, mưa tim ở mốc, thông báo chia sẻ, thẻ bình chọn nhanh A/B/C.
// Chỉ animate transform + opacity (CSS transition / WAAPI). Mọi phần tử dọn đúng một lần, ngân sách nhả đúng một lần.
// Mọi chữ do người xem/máy chủ gửi đều đặt bằng textContent.
import { $, avatar } from './util.js';
import { isLite } from './theme.js';
import { qualityLevel } from './fx-perf.js';
import { createBudget } from './fx-cinema-logic.js';
import { banner } from './fx.js';
import { launchMassiveFireworks } from './particles.js';
import { lanternRise } from './fx-cinema.js';

if (typeof document !== 'undefined' && !document.getElementById('fx-engage-css')) {
  const link = document.createElement('link');
  link.id = 'fx-engage-css';
  link.rel = 'stylesheet';
  link.href = new URL('../../css/fx-engage.css', import.meta.url).href;
  document.head?.appendChild(link);
}

const clip = (s) => Array.from(String(s ?? '')).slice(0, 28).join('');
const clipQ = (s) => Array.from(String(s ?? '')).slice(0, 90).join('');
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const fmt = (v) => num(v).toLocaleString('vi-VN');
const rnd = (a, b) => a + Math.random() * (b - a);
const div = (cls, text) => {
  const el = Object.assign(document.createElement('div'), { className: cls });
  if (text != null) el.textContent = text;
  return el;
};

/* ---------------------------------------------------------------- thanh tim */

let hCard = null, hText = null, hFill = null;
let hShown = false, hLastText = '', hLastScale = -1;
let pollShown = false; // thẻ bình chọn đang hiện -> hạ thanh tim xuống
let hView = null, coverIv = null; // view tim mới nhất; bộ kiểm tra 0,5 giây chỉ chạy lúc thanh bị thẻ khác che

// thẻ Đại chiến (#duel, lớp .show) hoặc rương (#chestWrap, thuộc tính hidden) đang hiện: thanh tim (y 360-416) có thể che đáy thẻ
function coveredByCard() {
  try {
    const d = $('#duel'), c = $('#chestWrap');
    return !!((d && d.classList.contains('show')) || (c && !c.hidden));
  } catch { return false; }
}

function stopCover() { if (coverIv !== null) { clearInterval(coverIv); coverIv = null; } }

function applyHeartVis() {
  if (!hCard || !hView) { stopCover(); return; }
  const want = !coveredByCard();
  if (want !== hShown) { hShown = want; hCard.classList.toggle('show', want); }
  if (!want) { if (coverIv === null) coverIv = setInterval(applyHeartVis, 500); } else stopCover();
}

function ensureHearts() {
  if (hCard && hCard.isConnected) return hCard;
  const stage = $('#stage');
  if (!stage) return null;
  hCard = div('hrt');
  hText = div('hrt-t');
  const bar = div('hrt-bar');
  hFill = div('hrt-fill');
  bar.appendChild(hFill);
  hCard.append(hText, bar);
  hCard.classList.toggle('low', pollShown);
  hLastText = ''; hLastScale = -1; hShown = false;
  stage.appendChild(hCard);
  return hCard;
}

export function renderHearts(view) {
  try {
    hView = view || null;
    if (!view) {
      stopCover();
      if (hShown && hCard) { hShown = false; hCard.classList.remove('show'); }
      return;
    }
    if (!ensureHearts()) return;
    const total = num(view.total), next = num(view.next);
    const text = `❤️ ${fmt(total)}/${fmt(next)}`;
    if (text !== hLastText) { hLastText = text; hText.textContent = text; }
    const r = Math.min(1, Math.max(0, num(view.pct) / 100));
    if (r !== hLastScale) { hLastScale = r; hFill.style.transform = `scaleX(${r})`; }
    applyHeartVis(); // ẩn (opacity 0 + visibility hidden sau khi mờ) khi thẻ Đại chiến / rương đang hiện, hiện lại khi chúng ẩn
  } catch { /* hiệu ứng phụ: không bao giờ làm hỏng luồng chính */ }
}

/* ------------------------------------------------------------ mốc tim + mưa tim */

const RAIN_MAX = 14;
const rainBudget = createBudget(RAIN_MAX);

function heartRain(count) {
  const stage = $('#stage');
  if (!stage) return;
  for (let i = 0; i < count; i++) {
    if (!rainBudget.tryAcquire()) return;
    let el = null, over = false;
    const finish = () => {
      if (over) return;
      over = true;
      try { el?.remove(); } catch { /* bỏ qua */ }
      rainBudget.release();
    };
    try {
      const dur = rnd(2600, 3800), delay = rnd(0, 900);
      const rise = rnd(900, 1500), dx = rnd(-60, 60);
      el = document.createElement('i');
      el.className = 'hrt-fly';
      el.textContent = '❤️';
      el.style.left = `${Math.round(rnd(60, 1000))}px`;
      el.style.top = '1800px';
      el.style.fontSize = `${Math.round(rnd(40, 66))}px`;
      stage.appendChild(el);
      setTimeout(finish, dur + delay + 600);
      el.animate([
        { transform: 'translate3d(0,0,0) scale(.6)', opacity: 0 },
        { offset: 0.12, opacity: 1 },
        { offset: 0.8, opacity: 0.9 },
        { transform: `translate3d(${dx}px,${-rise}px,0) scale(1)`, opacity: 0 },
      ], { duration: dur, delay, easing: 'ease-out', fill: 'both' }).finished.then(finish, finish);
    } catch { finish(); }
  }
}

const HEART_CD = 8000; // hai mốc tim liên tiếp trong 8 giây: bỏ banner + pháo hoa, chỉ còn mưa tim nhẹ
let hLastMs = 0;

export function heartMilestone(ev) {
  try {
    const m = ev || {};
    const n = num(m.milestone) || num(m.total);
    const now = Date.now(), gap = now - hLastMs;
    const cooling = hLastMs > 0 && gap >= 0 && gap < HEART_CD;
    if (!cooling) {
      hLastMs = now;
      let busy = false;
      try { busy = !!$('#banner')?.classList.contains('show'); } catch { /* bỏ qua */ }
      if (!busy) { // banner khác đang hiện thì không đè
        try {
          banner(`❤️ ĐỦ ${fmt(n)} LƯỢT TIM`, 'CẢM ƠN BÀ CON', 'cùng thả tim cho quê hương nào!', 5000);
        } catch { /* bỏ qua */ }
      }
    }
    if (isLite()) return;
    const q = qualityLevel();
    if (cooling) {
      if (rainBudget.active === 0) heartRain(q >= 2 ? 3 : 6); // mưa nhẹ, chỉ khi chưa có mưa nào
      return;
    }
    if (q < 2) {
      try { launchMassiveFireworks(); } catch { /* bỏ qua */ }
    }
    heartRain(q >= 2 ? 6 : RAIN_MAX);
  } catch { /* hiệu ứng phụ */ }
}

/* ------------------------------------------------------------ thông báo chia sẻ */

const SHARE_TOTAL = 2600, SHARE_IN = 380, SHARE_OUT = 380;
const shareBudget = createBudget(1);

export function showShare(ev) {
  try {
    if (!ev || isLite()) return;
    const stage = $('#stage');
    if (!stage) return;
    if (!shareBudget.tryAcquire()) return; // đang có một thông báo: bỏ cái sau, không xếp hàng
    let el = null, over = false;
    const finish = () => {
      if (over) return;
      over = true;
      try { el?.remove(); } catch { /* bỏ qua */ }
      shareBudget.release();
    };
    try {
      const name = clip(ev.name) || 'Ai đó';
      el = div('shr');
      const av = div('shr-av');
      avatar(av, name, typeof ev.avatar === 'string' ? ev.avatar : '');
      const tx = div('shr-tx');
      tx.append(div('shr-n', `🔗 ${name}`), div('shr-s', 'vừa chia sẻ live!'));
      el.append(av, tx);
      stage.appendChild(el);
      setTimeout(finish, SHARE_TOTAL + 600);
      const tIn = SHARE_IN / SHARE_TOTAL, tOut = 1 - SHARE_OUT / SHARE_TOTAL;
      el.animate([
        { transform: 'translateY(-30px) scale(.94)', opacity: 0, easing: 'cubic-bezier(.2,1.2,.4,1)' },
        { offset: tIn, transform: 'translateY(0) scale(1)', opacity: 1, easing: 'linear' },
        { offset: tOut, transform: 'translateY(0) scale(1)', opacity: 1, easing: 'ease-in' },
        { transform: 'translateY(-16px) scale(.97)', opacity: 0 },
      ], { duration: SHARE_TOTAL, fill: 'both' }).finished.then(finish, finish);
    } catch { finish(); return; }
    if (typeof ev.prov === 'string' && ev.prov) {
      try { lanternRise(ev.prov); } catch { /* bỏ qua */ } // lanternRise tự kiểm tra tỉnh hợp lệ, lite, chất lượng
    }
  } catch { /* hiệu ứng phụ */ }
}

/* ---------------------------------------------------------------- bình chọn */

const LETTERS = ['A', 'B', 'C'];
const POLL_HOLD = 2500;

let pCard = null, pQ = null, pFt = null, pFtT = null;
let pRows = []; // { row, fill, label, pct }
let iv = null, holdT = null;
let receivedAt = 0, leftMs = 0;

function ensurePoll() {
  if (pCard && pCard.isConnected) return pCard;
  const stage = $('#stage');
  if (!stage) return null;
  pCard = div('pol');
  pQ = div('pol-q');
  pCard.appendChild(pQ);
  pRows = LETTERS.map(() => {
    const row = div('pol-r');
    const fill = div('pol-f');
    const label = Object.assign(document.createElement('span'), { className: 'pol-l' });
    const pct = Object.assign(document.createElement('span'), { className: 'pol-p' });
    row.append(fill, label, pct);
    row.hidden = true;
    pCard.appendChild(row);
    return { row, fill, label, pct };
  });
  pFt = div('pol-ft');
  const fl = Object.assign(document.createElement('span'), { className: 'pol-fl' });
  pFtT = Object.assign(document.createElement('span'), { className: 'pol-ft-t' });
  pFt.append(fl, pFtT);
  pFt._l = fl;
  pCard.appendChild(pFt);
  stage.appendChild(pCard);
  return pCard;
}

function stopTimer() { if (iv !== null) { clearInterval(iv); iv = null; } }
function clearHold() { if (holdT !== null) { clearTimeout(holdT); holdT = null; } }

function setPollShown(v) {
  pollShown = v;
  hCard?.classList.toggle('low', v);
}

function hidePoll() {
  clearHold();
  stopTimer();
  if (!pollShown) return;
  setPollShown(false);
  pCard?.classList.remove('show');
}

function revealPoll() {
  setPollShown(true);
  pCard.classList.add('show');
}

function tickText() {
  try {
    const ms = Math.max(0, leftMs - (performance.now() - receivedAt));
    pFtT.textContent = `còn ${Math.ceil(ms / 1000)}s`;
  } catch { /* bỏ qua */ }
}

// pcts: mảng phần trăm (0..100) cùng độ dài options; thiếu thì coi là 0.
function fillRows(options, pcts) {
  for (let i = 0; i < pRows.length; i++) {
    const r = pRows[i];
    const opt = options[i];
    if (opt == null || opt === '') { r.row.hidden = true; continue; }
    r.row.hidden = false;
    r.row.classList.remove('win');
    r.label.textContent = `${LETTERS[i]}. ${clip(opt)}`;
    const p = Math.min(100, Math.max(0, Math.round(num(pcts[i]))));
    r.pct.textContent = `${p}%`;
    r.fill.style.transform = `scaleX(${p / 100})`;
  }
}

function voteHint(n) {
  const l = LETTERS.slice(0, Math.max(2, Math.min(3, n)));
  return `Comment ${l.slice(0, -1).join(', ')} hay ${l[l.length - 1]} để bình chọn`;
}

export function renderPoll(view) {
  try {
    if (!view || !Array.isArray(view.options) || view.options.length === 0) {
      if (holdT === null) hidePoll(); // đang giữ chữ kết quả thì để bộ đếm giờ tự ẩn
      return;
    }
    if (!ensurePoll()) return;
    clearHold();
    pCard.classList.remove('won');
    pQ.textContent = clipQ(view.question);
    const opts = view.options.slice(0, 3);
    fillRows(opts, Array.isArray(view.pct) ? view.pct : []);
    pFt._l.textContent = voteHint(opts.length);
    receivedAt = performance.now();
    leftMs = Math.max(0, num(view.leftMs));
    tickText();
    if (iv === null) iv = setInterval(tickText, 250);
    if (!pollShown) revealPoll();
  } catch { /* hiệu ứng phụ */ }
}

export function pollEnd(ev) {
  try {
    const m = ev || {};
    const total = num(m.total);
    const opts = Array.isArray(m.options) ? m.options.slice(0, 3) : [];
    if (m.cancel || total <= 0 || opts.length === 0) { hidePoll(); return; }
    const w = Math.trunc(num(m.winner));
    const tie = !!m.tie;
    const hasWinner = !tie && Number.isFinite(Number(m.winner)) && w >= 0 && w < opts.length;
    if (!tie && !hasWinner) { hidePoll(); return; }
    if (!ensurePoll()) return;
    clearHold();
    stopTimer();
    const counts = Array.isArray(m.counts) ? m.counts : [];
    pQ.textContent = clipQ(m.question);
    fillRows(opts, opts.map((_, i) => (num(counts[i]) * 100) / total));
    if (hasWinner) pRows[w]?.row.classList.add('win');
    pFt._l.textContent = tie ? 'Hòa nhau!' : `🏆 ${clip(opts[w])} thắng!`;
    pFtT.textContent = '';
    pCard.classList.add('won');
    if (!pollShown) revealPoll();
    holdT = setTimeout(() => {
      holdT = null;
      hidePoll();
    }, POLL_HOLD);
  } catch { /* hiệu ứng phụ */ }
}
