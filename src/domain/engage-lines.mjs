// Lời MC cho mục tiêu tim, thưởng chia sẻ và bình chọn: thuần (không import), không nhắc quà/xu/tặng.

// Chọn chỉ số ngẫu nhiên trong [0, len) khác `last` (khi len > 1). rand() nhận giá trị [0, 1].
export function pickIndex(len, last = -1, rand = Math.random) {
  if (!(len > 1)) return 0;
  let i = Math.min(len - 1, Math.max(0, Math.floor(rand() * len)));
  if (i === last) i = (i + 1) % len;
  return i;
}

export const HEART_LINES = [
  m => `Đã đủ ${m} lượt tim! Cảm ơn bà con đã thả tim cho quê hương!`,
  m => `${m} lượt tim rồi! Bà con thả tim nhiệt tình quá!`,
  m => `Tuyệt vời, cả phòng vừa chạm mốc ${m} lượt tim! Mình tiếp tục thả tim nào!`,
  m => `Mốc ${m} tim đã về đích! Cảm ơn mọi người nhé!`,
  m => `Cả phòng vừa đạt ${m} lượt tim, thương bà con quá!`,
];

export const SHARE_LINES = [
  n => `Cảm ơn ${n} đã chia sẻ live!`,
  n => `${n} vừa chia sẻ livestream, cảm ơn bạn nhiều nhé!`,
  n => `Có bạn ${n} chia sẻ live rồi, cảm ơn bạn!`,
  n => `Cảm ơn ${n} đã lan tỏa buổi live này!`,
  n => `${n} chia sẻ live nè bà con, cảm ơn bạn nha!`,
];

const letters = ['A', 'B', 'C'];

export function pollStartLine(question, options, sec) {
  const opts = options.map((o, i) => `${letters[i]} là ${o}`).join(', ');
  return `Bình chọn nhanh ${sec} giây! ${question} ${opts}. Bà con comment chữ cái để chọn nhé!`;
}

export const POLL_WIN_LINES = [
  (o, p) => `Bình chọn xong! ${o} dẫn đầu với ${p}% phiếu.`,
  (o, p) => `Kết quả bình chọn: ${o} thắng với ${p}% phiếu!`,
  (o, p) => `Xong rồi! Bà con chọn ${o}, chiếm ${p}% phiếu.`,
];

export const POLL_TIE_LINES = [
  () => 'Bình chọn xong! Hòa nhau, không phân thắng bại!',
  () => 'Hòa nhau rồi! Bằng phiếu nhau luôn!',
];
