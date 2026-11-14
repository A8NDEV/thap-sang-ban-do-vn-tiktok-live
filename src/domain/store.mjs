// TẦNG 3 — kho trạng thái duy nhất (Single Source of Truth): buổi live S, người xem quen (fans), cài đặt.
// Ghi đĩa có hoãn (debounce) để không nghẽn ổ khi tim/bình luận dồn dập; tắt app thì ghi ngay (flushAll).
import fs from 'node:fs';
import { FILES, readJSON, writeJSON } from '../core/paths.mjs';
import { settings, applySettings } from './settings.mjs';

export const freshSession = () => ({ start: Date.now(), lastAct: Date.now(), lit: {}, who: {}, pts: {}, gifts: {}, donors: {}, wins: {}, roundNo: 1, roundEnd: 0, last: null });

export let S = freshSession();
export let fans = {};
// Chủ tỉnh: giữ qua mọi buổi live (data/owners.json) — totals[tỉnh][uid] = tổng xu tặng cho tỉnh đó
export const owners = { totals: {}, owner: {} };

export function loadStore(){
  const saved = readJSON(FILES.state, {}) || {};
  if (saved.settings && (saved.v || 1) < 2) { delete saved.settings.idleGapSec; delete saved.settings.likePts; }   // bản rất cũ: MC nghỉ 25 giây, tim có điểm
  if (saved.settings && (saved.v || 1) < 3) { delete saved.settings.voice; delete saved.settings.rate; }           // bản 1.0: giọng nữ tốc độ 0 → giọng nam +15% như Quán Nhậu
  if (saved.settings && (saved.v || 1) < 4) { if (saved.settings.fullCoins === 10000) delete saved.settings.fullCoins; }       // ngưỡng "cả nước rực sáng" cũ 10000 xu quá cao → dùng mặc định mới (500 xu)
  applySettings(saved.settings);
  if (saved.S && saved.S.lit) {
    S = { ...freshSession(), ...saved.S };
    if (settings.newSessionHours && Date.now() - (S.lastAct || 0) > settings.newSessionHours * 3600_000) S = freshSession();
  }
  fans = readJSON(FILES.fans, {}) || {};
  Object.assign(owners, { totals: {}, owner: {} }, readJSON(FILES.owners, {}) || {});
}

// đổi buổi live / bản đồ mới (giữ hoặc bỏ số vòng thắng)
export function resetSession(keepWins = false){ const wins = S.wins; S = freshSession(); if (keepWins) S.wins = wins; }

let saveT = null, fansT = null, ownersT = null;
const writeOwners = () => { try { writeJSON(FILES.owners, owners); } catch {} };
export function saveOwners(){ clearTimeout(ownersT); ownersT = setTimeout(() => { ownersT = null; writeOwners(); }, 1500); }
const writeState = () => { try { writeJSON(FILES.state, { v: 4, settings, S }); } catch {} };
function writeFans(){
  try {
    const ids = Object.keys(fans);
    if (ids.length > 30000) ids.sort((a, b) => (fans[a].seen || 0) - (fans[b].seen || 0)).slice(0, ids.length - 30000).forEach(k => delete fans[k]);
    writeJSON(FILES.fans, fans);
  } catch {}
}
export function save(){ clearTimeout(saveT); saveT = setTimeout(() => { saveT = null; writeState(); }, 800); }
export function saveFans(){ clearTimeout(fansT); fansT = setTimeout(() => { fansT = null; writeFans(); }, 1500); }
export function flushAll(){
  if (saveT) { clearTimeout(saveT); saveT = null; }
  if (fansT) { clearTimeout(fansT); fansT = null; writeFans(); }
  if (ownersT) { clearTimeout(ownersT); ownersT = null; writeOwners(); }
  writeState();
}
export const stateFileExists = () => fs.existsSync(FILES.state);
