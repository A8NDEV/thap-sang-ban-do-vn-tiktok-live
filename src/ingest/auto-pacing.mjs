// TẦNG 1 — Hệ thống Tự Động Giữ Nhịp Livestream (Auto-Pacing Engine)
// Tạo tương tác tự nhiên (bình luận thắp đèn, thả tim, follow, tặng quà nhỏ)
// giúp phòng live luôn sôi động, giữ chân người xem mới và tự động nhường sóng cho người thật.

import { S } from '../domain/store.mjs';
import { settings } from '../domain/settings.mjs';
import { NAMES } from '../domain/provinces.mjs';
import { duelView } from '../domain/duel.mjs';
import { isChestActive, chestView } from '../domain/chest.mjs';
import { onChat, onLike, onFollow, onGift } from '../domain/game.mjs';
import { norm } from './sanitize.mjs';

const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

const HOS = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý', 'Đinh', 'Đoàn', 'Trịnh', 'Mai', 'Lâm', 'Phùng', 'Châu'];
const NAM_TENS = ['Văn Tuấn', 'Minh Khang', 'Quốc Bảo', 'Hoàng Nam', 'Tuấn Kiệt', 'Đức Anh', 'Thanh Tùng', 'Hoài Nam', 'Tấn Phát', 'Gia Huy', 'Nhật Minh', 'Trọng Hiếu', 'Xuân Trường', 'Hữu Thắng', 'Minh Quân', 'Duy Mạnh', 'Tiến Dũng', 'Quang Hải', 'Đình Trọng', 'Văn Toàn', 'Hùng Dũng', 'Tuấn Anh', 'Việt Anh', 'Thái Sơn', 'Khắc Ngọc', 'Thành Long', 'Văn Đạt', 'Bá Tùng', 'Hồng Quân', 'Quốc Anh', 'Bảo Long', 'Đức Phúc', 'Tuấn Hưng', 'Hoàng Dũng', 'Việt Dũng', 'Thế Anh', 'Công Phượng', 'Văn Hậu', 'Hoàng Đức'];
const NU_TENS = ['Thảo Vy', 'Hương Giang', 'Ngọc Ánh', 'Hải Yến', 'Quỳnh Như', 'Mỹ Duyên', 'Kim Chi', 'Bảo Ngọc', 'Phương Thảo', 'Thu Trang', 'Khánh Linh', 'Ánh Tuyết', 'Diệu Linh', 'Thùy Dung', 'Bích Phương', 'Kiều Trinh', 'Thanh Hằng', 'Mai Phương', 'Hà My', 'Lan Anh', 'Bảo Vy', 'Ngọc Mai', 'Trúc Ly', 'Ánh Nguyệt', 'Như Quỳnh', 'Tuyết Mai', 'Hồng Nhung', 'Minh Châu', 'Cẩm Tú', 'Thanh Trúc', 'Yến Nhi', 'Thùy Tiên', 'Hà Anh', 'Thanh Tâm', 'Thu Thảo'];
const NICKNAMES = [
  'Bé Bắp', 'Mèo Mập', 'Cậu Út', 'Cô Ba Sài Gòn', 'Long Ka', 'Bống Bống',
  'Tuấn Còi 37', 'Hải Phòng 15', 'Bình Dương 61', 'Nghệ An 37', 'Quảng Nam 92',
  'Hà Nội Phố', 'Miền Tây Quê Tôi', 'Gió Mùa Thu', 'Thích Đi Phượt', 'Gia Đình Nhỏ',
  'Kem Dâu', 'Mây Lang Thang', 'Hoa Hướng Dương', 'Út Nhỏ', 'Chàng Khờ', 'Sơn Ca',
  'Bảo Bối', 'Hạt Tiêu', 'Nhím Xù', 'Bông Lan Trứng Muối', 'Trà Sữa Full Topping',
  'Heo Con', 'Bác Ba Phi', 'Chú Bảy Cần Thơ', 'Chị Tư Hóc Môn', 'Bé Heo',
  'Cún Con', 'Thợ Săn Mây', 'Đời Phiêu Lãng', 'Nắng Ban Mai'
];

// Hồ bơi người xem đang hoạt động (tái sử dụng người xem để 1 người có nhiều hành động tự nhiên)
const activePool = [];
function getOrGenerateUser(){
  // 35% dùng lại người đang trong phòng để tạo cảm giác người thật đang xem
  if (activePool.length > 0 && Math.random() < 0.35) {
    const user = pick(activePool);
    user.acts = (user.acts || 0) + 1;
    if (user.acts >= 4) {
      const idx = activePool.indexOf(user);
      if (idx >= 0) activePool.splice(idx, 1);
    }
    return user;
  }

  const r = Math.random();
  let name = '';
  if (r < 0.45) {
    // Họ + Tên
    const ho = pick(HOS);
    const ten = Math.random() < 0.5 ? pick(NAM_TENS) : pick(NU_TENS);
    name = `${ho} ${ten}`;
  } else if (r < 0.70) {
    // Nickname đời thường
    name = pick(NICKNAMES);
  } else if (r < 0.88) {
    // Tên + số năm sinh / số may mắn
    const base = pick([...NAM_TENS, ...NU_TENS]).split(' ').pop();
    const suffix = pick([rnd(90, 99), rnd(2000, 2005), 'pro', 'vn', rnd(1, 99)]);
    name = `${base}_${suffix}`;
  } else {
    // user + mã số
    name = `user${rnd(100000, 999999)}`;
  }

  const uid = 'auto_' + norm(name).trim().replace(/\s+/g, '_') + '_' + rnd(100, 999);
  const user = { uid, name, acts: 1, home: '' };
  activePool.push(user);
  if (activePool.length > 25) activePool.shift();
  return user;
}

// Câu nói tự nhiên theo ngữ cảnh
function pickComment(prov){
  const duel = duelView();
  if (duel && (prov === duel.a || prov === duel.b)) {
    const PATTERNS = [
      `${prov} cố lên anh em ơi`,
      `${prov} lên nào`,
      `${prov} mãi đỉnh`,
      `${prov} không chịu thua đâu nha`,
      `${prov} kéo lại nào`,
      `${prov} vô địch`,
      `${prov} đẩy mạnh lên anh em`,
      `${prov} 10 điểm`,
      `${prov} quyết thắng`,
      `anh em ${prov} đâu hết rồi`,
      `${prov} lên top nào`
    ];
    return pick(PATTERNS);
  }

  if (isChestActive()) {
    const cv = chestView();
    if (cv && prov === cv.prov) {
      const CHEST_PATS = [
        `${prov} mở rương đi`,
        `cố lên sắp nổ rương rồi`,
        `bà con ${prov} vào mở rương nào`,
        `${prov} nhận quà nào`,
        `${prov} đẩy năng lượng lên`,
        `mở rương ${prov} lấy điểm thưởng kìa`
      ];
      return pick(CHEST_PATS);
    }
  }

  const PATTERNS = [
    `${prov} chào cả nhà nha`,
    `${prov} điểm danh nè`,
    `${prov} có ai không`,
    `${prov} mãi đỉnh`,
    `${prov} quê tôi`,
    `chào bà con ${prov}`,
    `${prov} lên top`,
    `thắp một ngọn đèn cho ${prov} nhé`,
    `xin chào từ ${prov}`,
    `${prov} nè ad`,
    `dân ${prov} đâu rồi`,
    `${prov} xin 1 chân`,
    `${prov} có mặt`,
    `quê mình ${prov}`,
    `góp 1 đèn cho quê ${prov}`
  ];
  return pick(PATTERNS);
}

// Theo dõi hoạt động của người xem thật
let lastRealAct = 0;
export function markRealActivity(){
  lastRealAct = Date.now();
}

let running = false;
let autoTimer = null;

export function isAutoPacingRunning(){
  return running;
}

function nextDelay(){
  const speed = settings.autoPaceSpeed || 'normal';
  if (speed === 'fast') return rnd(4000, 7000);
  if (speed === 'slow') return rnd(12000, 18000);
  return rnd(6000, 10000); // normal: 6–10 giây một hành động giữ nhịp
}

function doPacingStep(){
  if (!running || !settings.autoPacing) return;

  const duel = duelView();
  const chest = isChestActive() ? chestView() : null;

  // Chọn tỉnh mục tiêu
  let prov = '';
  if (duel) {
    // Khi Đại chiến: 50/50 kéo cho đội A hoặc đội B (tạo kịch tính giằng co liên tục)
    if (duel.sa < duel.sb) {
      prov = Math.random() < 0.65 ? duel.a : duel.b;
    } else if (duel.sb < duel.sa) {
      prov = Math.random() < 0.65 ? duel.b : duel.a;
    } else {
      prov = Math.random() < 0.5 ? duel.a : duel.b;
    }
  } else if (chest && Math.random() < 0.45) {
    // Khi có rương: 45% hướng về tỉnh có rương để hỗ trợ mở rương
    prov = chest.prov;
  } else {
    // Hòa quyện: Bot chọn ngẫu nhiên các tỉnh trên toàn quốc để thắp sáng và duy trì điểm số
    // (Bất kỳ lúc nào người thật bình luận tỉnh nào, người thật cũng lập tức chiếm quyền và nổ hiệu ứng!)
    prov = pick(NAMES);
  }

  const user = getOrGenerateUser();
  if (prov && !user.home) user.home = prov;

  // Quyết định hành động: Chat (50%) | Tim (24%) | Follow (16%) | Quà nhỏ (10%)
  const r = Math.random();
  if (r < 0.50) {
    // 1. Bình luận thắp đèn
    const text = pickComment(prov);
    onChat(user.uid, user.name, text, '');
  } else if (r < 0.74) {
    // 2. Thả tim
    const likes = rnd(8, 25);
    onLike(user.uid, user.name, likes, '');
  } else if (r < 0.90) {
    // 3. Follow kênh (+20đ thường hoặc +25đ kéo co)
    onFollow(user.uid, user.name, '');
  } else if (settings.autoPaceGifts) {
    // 4. Quà nhỏ mồi vinh danh (Hoa hồng 1 xu hoặc Tim ngón tay 5 xu)
    const [giftName, coins] = Math.random() < 0.75 ? ['Hoa hồng', 1] : ['Tim ngón tay', 5];
    onGift(user.uid, user.name, giftName, 1, coins, '');
  }

  // Hẹn giờ lượt tiếp theo
  clearTimeout(autoTimer);
  autoTimer = setTimeout(doPacingStep, nextDelay());
}

export function startAutoPacing(){
  if (running) return;
  running = true;
  clearTimeout(autoTimer);
  autoTimer = setTimeout(doPacingStep, 3000);
}

export function stopAutoPacing(){
  running = false;
  clearTimeout(autoTimer);
  autoTimer = null;
}

