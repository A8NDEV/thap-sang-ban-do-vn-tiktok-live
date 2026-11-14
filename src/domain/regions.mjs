// TẦNG 3 — "Đại Chiến Anh Em 3 Miền" (Bắc - Trung - Nam)
// Tích hợp tương tác bình luận, thả tim, follow, tặng quà solo theo 3 Miền.

import { broadcast, addLog } from '../core/bus.mjs';
import { norm } from '../ingest/sanitize.mjs';

// Danh sách 34 tỉnh thành phân chia theo 3 Miền
export const REGION_PROVINCES = {
  bac: [
    'Hà Nội', 'Bắc Ninh', 'Quảng Ninh', 'Hải Phòng', 'Hưng Yên', 'Ninh Bình',
    'Cao Bằng', 'Tuyên Quang', 'Lào Cai', 'Thái Nguyên', 'Lạng Sơn', 'Phú Thọ',
    'Điện Biên', 'Sơn La'
  ],
  trung: [
    'Thanh Hóa', 'Nghệ An', 'Hà Tĩnh', 'Quảng Bình', 'Quảng Trị', 'Thừa Thiên Huế',
    'Đà Nẵng', 'Quảng Nam', 'Khánh Hòa', 'Gia Lai', 'Đắk Lắk', 'Lâm Đồng'
  ],
  nam: [
    'TP. Hồ Chí Minh', 'Đồng Nai', 'Tây Ninh', 'Vĩnh Long', 'Đồng Tháp',
    'An Giang', 'Cần Thơ', 'Cà Mau'
  ]
};

// Từ khóa trực tiếp cho từng miền
const REGION_KEYWORDS = {
  bac: ['mien bac', 'bac bo', 'dan bac', 'anh em bac', 'doi bac', 'team bac', 'mb'],
  trung: ['mien trung', 'trung bo', 'dan trung', 'anh em trung', 'doi trung', 'team trung', 'mt', 'khuc ruot mien trung', 'tay nguyen'],
  nam: ['mien nam', 'nam bo', 'dan nam', 'anh em nam', 'doi nam', 'team nam', 'mn', 'mien tay', 'tay nam bo', 'dong nam bo']
};

// Ánh xạ từ tên tỉnh -> mã miền
const PROV_TO_REGION = {};
for (const [reg, provs] of Object.entries(REGION_PROVINCES)) {
  for (const p of provs) {
    PROV_TO_REGION[p] = reg;
    PROV_TO_REGION[norm(p).trim()] = reg;
  }
}

export function regionOf(provOrText){
  if (!provOrText) return null;
  const s = norm(provOrText).trim();
  // 1. Kiểm tra theo tên tỉnh
  if (PROV_TO_REGION[provOrText]) return PROV_TO_REGION[provOrText];
  if (PROV_TO_REGION[s]) return PROV_TO_REGION[s];

  // 2. Kiểm tra từ khóa 3 miền trực tiếp
  for (const [reg, words] of Object.entries(REGION_KEYWORDS)) {
    for (const w of words) {
      if (s === w || s.includes(w)) return reg;
    }
  }

  // 3. Quần đảo Hoàng Sa, Trường Sa tính cho Miền Trung
  if (s.includes('hoang sa') || s.includes('truong sa')) return 'trung';

  return null;
}

// Trạng thái điểm số 3 Miền
export const regionsState = {
  bac: { name: 'MIỀN BẮC', code: 'bac', color: '#ff2a5f', pts: 0, coins: 0, cmt: 0, likes: 0, follows: 0, donors: {}, lastUser: null },
  trung: { name: 'MIỀN TRUNG', code: 'trung', color: '#ffd23f', pts: 0, coins: 0, cmt: 0, likes: 0, follows: 0, donors: {}, lastUser: null },
  nam: { name: 'MIỀN NAM', code: 'nam', color: '#00d2ff', pts: 0, coins: 0, cmt: 0, likes: 0, follows: 0, donors: {}, lastUser: null }
};

let modalOpen = false;
export const is3MienModalOpen = () => modalOpen;
export function toggle3MienModal(on){
  modalOpen = on !== undefined ? !!on : !modalOpen;
  addLog(modalOpen ? '⚔️ Đã MỞ ĐẠI CHIẾN 3 MIỀN (đè lên màn hình overlay)' : '⏹️ Đã ĐÓNG ĐẠI CHIẾN 3 MIỀN (trở lại bản đồ)');
  broadcast({ t: 'regionsModal', open: modalOpen, snapshot: getRegionsSnapshot() });
  return { ok: true, open: modalOpen };
}

export function getRegionsSnapshot(){
  const total = regionsState.bac.pts + regionsState.trung.pts + regionsState.nam.pts;
  const calcPct = pts => total > 0 ? Math.round((pts / total) * 100) : 33;
  return {
    t: 'regionsState',
    open: modalOpen,
    regions: {
      bac: { ...regionsState.bac, pct: calcPct(regionsState.bac.pts), topDonor: getTopDonor('bac') },
      trung: { ...regionsState.trung, pct: calcPct(regionsState.trung.pts), topDonor: getTopDonor('trung') },
      nam: { ...regionsState.nam, pct: calcPct(regionsState.nam.pts), topDonor: getTopDonor('nam') },
    },
    totalPts: total,
    leader: getLeaderRegion(),
  };
}

function getTopDonor(regCode){
  const donors = regionsState[regCode]?.donors || {};
  let top = null, max = 0;
  for (const [name, d] of Object.entries(donors)) {
    if (d.pts > max) { max = d.pts; top = { name, ...d }; }
  }
  return top;
}

function getLeaderRegion(){
  let lead = 'bac', max = regionsState.bac.pts;
  if (regionsState.trung.pts > max) { max = regionsState.trung.pts; lead = 'trung'; }
  if (regionsState.nam.pts > max) { max = regionsState.nam.pts; lead = 'nam'; }
  return lead;
}

let pushRegionsT = null;
let lastAct = null;
function pushRegionsUpdate(act = null){
  if (act) lastAct = act;
  if (!pushRegionsT) {
    pushRegionsT = setTimeout(() => {
      pushRegionsT = null;
      const snap = getRegionsSnapshot();
      if (lastAct) { snap.act = lastAct; lastAct = null; }
      broadcast(snap);
    }, 150);
  }
}

export function addRegionScore(provOrText, type, amount, name = '', avatar = '', extra = {}){
  const regCode = regionOf(provOrText);
  if (!regCode) return null;

  const R = regionsState[regCode];
  if (!R) return null;

  R.pts += amount;
  if (type === 'chat') R.cmt += 1;
  else if (type === 'like') R.likes += (extra.n || 1);
  else if (type === 'follow') R.follows += 1;
  else if (type === 'gift') {
    R.coins += (extra.coins || 0);
  }

  if (name) {
    R.lastUser = { name, avatar, type, amount, prov: provOrText, at: Date.now() };
    const D = R.donors[name] ||= { name, avatar, pts: 0, coins: 0 };
    D.pts += amount;
    if (extra.coins) D.coins += extra.coins;
    if (avatar) D.avatar = avatar;
  }

  pushRegionsUpdate({
    region: regCode,
    type,
    amount,
    name,
    avatar,
    prov: provOrText,
    gift: extra.gift || '',
    coins: extra.coins || 0
  });

  return regCode;
}

export function resetRegionsScore(){
  for (const reg of Object.values(regionsState)) {
    reg.pts = 0;
    reg.coins = 0;
    reg.cmt = 0;
    reg.likes = 0;
    reg.follows = 0;
    reg.donors = {};
    reg.lastUser = null;
  }
  addLog('🔄 Đã đặt lại điểm số Đại Chiến 3 Miền');
  broadcast(getRegionsSnapshot());
}

