// Ngân hàng câu hỏi bình chọn nhanh: vui, trung tính (ẩm thực, quê hương, Tết, du lịch, âm nhạc...).
// Không nhắc tới tiền/quà/chính trị/tôn giáo. Mỗi câu 2-3 lựa chọn, mỗi lựa chọn <= 22 ký tự.

export const POLL_BANK = [
  { q: 'Sáng nay bạn ăn gì?', options: ['Phở', 'Bánh mì', 'Xôi'] },
  { q: 'Cà phê nào hợp bạn nhất?', options: ['Cà phê sữa đá', 'Cà phê muối', 'Bạc xỉu'] },
  { q: 'Bún bò Huế hay bún riêu?', options: ['Bún bò Huế', 'Bún riêu'] },
  { q: 'Tết này bạn mê bánh nào?', options: ['Bánh chưng', 'Bánh tét'] },
  { q: 'Nhà bạn chơi Tết với gì?', options: ['Hoa mai', 'Hoa đào', 'Cây quất'] },
  { q: 'Cuối tuần bạn thích đi đâu?', options: ['Biển', 'Núi', 'Phố cổ'] },
  { q: 'Cơm tấm hay bánh cuốn?', options: ['Cơm tấm', 'Bánh cuốn'] },
  { q: 'Món ăn vặt bạn mê nhất?', options: ['Trà sữa', 'Bánh tráng trộn', 'Chè'] },
  { q: 'Hát karaoke bạn chọn?', options: ['Nhạc trữ tình', 'Nhạc trẻ', 'Bolero'] },
  { q: 'Đi du lịch bạn chọn nơi nào?', options: ['Đà Lạt', 'Hội An', 'Phú Quốc'] },
  { q: 'Mùa nào đẹp nhất theo bạn?', options: ['Mùa hè', 'Mùa thu', 'Mùa đông'] },
  { q: 'Ăn phở có thêm quẩy không?', options: ['Có quẩy', 'Không quẩy'] },
  { q: 'Bún đậu mắm tôm, bạn thế nào?', options: ['Mê lắm', 'Thử rồi, né', 'Chưa dám thử'] },
  { q: 'Mì Quảng hay cao lầu?', options: ['Mì Quảng', 'Cao lầu'] },
  { q: 'Tết này bạn định làm gì?', options: ['Về quê', 'Đi du lịch', 'Ở nhà nghỉ'] },
  { q: 'Bạn là dân dậy sớm hay cú đêm?', options: ['Dậy sớm', 'Cú đêm'] },
  { q: 'Giải khát ngày nóng bạn chọn?', options: ['Trà đá', 'Nước mía', 'Sinh tố'] },
  { q: 'Bánh xèo hay bánh khọt?', options: ['Bánh xèo', 'Bánh khọt'] },
  { q: 'Chè nào ngon nhất?', options: ['Chè đậu xanh', 'Chè thái', 'Chè bưởi'] },
  { q: 'Trời mưa bạn thích làm gì?', options: ['Ngủ nướng', 'Xem phim', 'Cà phê ngắm mưa'] },
  { q: 'Ăn lẩu hay ăn nướng?', options: ['Lẩu', 'Đồ nướng'] },
  { q: 'Món cuốn nào bạn thích nhất?', options: ['Gỏi cuốn', 'Chả giò', 'Nem lụi'] },
  { q: 'Đi xa bạn chọn phương tiện nào?', options: ['Xe máy', 'Tàu hỏa', 'Máy bay'] },
  { q: 'Bánh mì kẹp gì là chân ái?', options: ['Thịt nướng', 'Trứng ốp la', 'Xíu mại'] },
  { q: 'Mứt Tết bạn thích loại nào?', options: ['Mứt gừng', 'Mứt dừa', 'Mứt bí'] },
  { q: 'Trời lạnh bạn muốn ăn gì?', options: ['Bắp xào', 'Cháo nóng', 'Mì cay'] },
  { q: 'Đặc sản miền Tây bạn mê?', options: ['Cá lóc nướng trui', 'Lẩu mắm', 'Hủ tiếu Mỹ Tho'] },
  { q: 'Món Hà Nội nào bạn mê nhất?', options: ['Bún chả', 'Chả cá Lã Vọng', 'Phở cuốn'] },
  { q: 'Trái cây mùa hè bạn chọn?', options: ['Dưa hấu', 'Xoài', 'Chôm chôm'] },
  { q: 'Đi ăn bạn thích đi cùng ai?', options: ['Một mình', 'Nhóm bạn'] },
  { q: 'Chụp ảnh check-in ở đâu đẹp?', options: ['Cầu Vàng', 'Phố cổ Hội An', 'Cánh đồng hoa'] },
  { q: 'Bữa trưa bạn hay chọn món nào?', options: ['Cơm', 'Bún', 'Mì'] },
  { q: 'Bạn hay nghe nhạc lúc nào?', options: ['Sáng sớm', 'Chiều tà', 'Đêm khuya'] },
  { q: 'Món Tết bạn mong nhất?', options: ['Thịt kho trứng', 'Dưa hành', 'Giò chả'] },
];

const indexOfRecent = (r) => {
  if (typeof r === 'number') return Number.isInteger(r) && r >= 0 && r < POLL_BANK.length ? r : -1;
  if (typeof r === 'string') return POLL_BANK.findIndex((p) => p.q === r);
  return -1;
};

const clone = (p) => ({ q: p.q, options: p.options.slice() });

// Chọn một câu không nằm trong `recent` (chỉ số hoặc nội dung câu, cũ nhất ở đầu mảng).
// Hết câu mới -> dùng lại câu cũ nhất trong `recent`.
export function pickPoll(rand = Math.random, recent = []) {
  const used = (Array.isArray(recent) ? recent : []).map(indexOfRecent).filter((i) => i >= 0);
  const usedSet = new Set(used);
  const fresh = [];
  for (let i = 0; i < POLL_BANK.length; i++) if (!usedSet.has(i)) fresh.push(i);
  if (fresh.length === 0) return clone(POLL_BANK[used[0]]);
  const r = Number(rand());
  const k = Math.min(fresh.length - 1, Math.max(0, Math.floor(Number.isFinite(r) ? r * fresh.length : 0)));
  return clone(POLL_BANK[fresh[k]]);
}
