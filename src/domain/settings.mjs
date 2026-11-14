// TẦNG 3 — cài đặt game (lưu chung trong data/state.json cùng dữ liệu buổi live).
import { clamp } from '../core/bus.mjs';
import { defaultGiftMap, cleanGiftMap } from './gift-acts.mjs';

export const settings = {
  roundMin: 5,                 // mỗi vòng đua thắp đèn (phút)
  commentPts: 1, likePts: 0,   // điểm mỗi bình luận (tối đa 2 giây/lần) · mỗi tim (0 = tim không tính điểm)
  followPts: 20,               // điểm mỗi lượt follow bình thường
  giftTiers: '1:3,5:30,30:100,100:500,1000:3000',   // bậc quà theo tổng xu mỗi lần tặng → điểm
  fullCoins: 500, fullPts: 10000,   // tặng đủ ngần này xu (một lần hoặc cộng dồn) → cả nước rực sáng
  music: true, musicVol: 50,
  voice: 'nam', rate: 15, pitch: 0, volume: 20,   // giọng nam Nam Minh như Quán Nhậu, đọc nhanh hơn 15%
  readFact: true, greetJoin: true, idleTalk: true, idleGapSec: 1, returnLight: true,
  newSessionHours: 3,          // vắng hoạt động quá N giờ → lần mở sau tự bắt đầu bản đồ mới (0 = không tự xóa)
  ownerOn: true,               // Chủ tỉnh: người tặng nhiều nhất cho mỗi tỉnh (giữ qua các buổi)
  duelOn: true, duelEveryMin: 10, duelSec: 60, duelBonus: 300, duelCmtPts: 5, duelLikePts: 1, duelFollowPts: 25,   // Đại chiến: đối đầu kéo co, cmt +5, like +1, follow +25
  autoPacing: true,            // Tự động giữ nhịp tương tác phòng live
  autoPaceSpeed: 'normal',     // tốc độ giữ nhịp: slow (10-15s) · normal (5-8s) · fast (3-5s)
  autoPaceGifts: true,         // thỉnh thoảng tặng quà nhỏ giữ nhịp
  giftMap: defaultGiftMap(),   // quà → hành động (bấm chọn bằng hình ở trang điều khiển, giống Sàn Quẩy)
  giftMenuOn: true,            // hiện thực đơn quà (hình quà + hành động) trên màn hình LIVE
  theme: 'mac-dinh',           // style màn hình LIVE: mac-dinh · son-mai · aurora · neon · hoi-an · radar · tet · giay-co
  map3d: false,                // Bản đồ 3D: nghiêng sâu, tỉnh nổi khối cao (dùng chung mọi style)
  fxLite: false,
  lensOn: true,                // Kính lúp: ô tròn phóng to tỉnh khi có quà lớn (bản đồ đứng yên)
  softZoom: false,             // Zoom nhẹ mượt kiểu quay phim (1,15-1,3 lần, lò xo) cho sự kiện quan trọng
  levelOn: true,               // Cấp độ người tặng (Đồng/Bạc/Vàng/Kim cương) theo tổng xu cộng dồn cả buổi
  levelTiers: '10,100,500,2000',   // 4 mốc xu tăng dần: cấp 1 Đồng, 2 Bạc, 3 Vàng, 4 Kim cương
  overtakeOn: true,            // cảnh "vượt hạng" khi người tặng vượt người khác trong top 5
  missionOn: false, missionEveryMin: 8, missionSec: 60, missionTarget: 30, missionPts: 300,   // nhiệm vụ cả phòng: mỗi N phút · M giây · cần X lượt comment tên tỉnh · điểm thưởng cho quê đó
  showFps: false,              // hiện FPS + mức chất lượng ở góc overlay (để đo máy; nhớ tắt khi live thật)
  camZoom: false,              // Camera zoom tỉnh: mặc định false (toàn cảnh cố định mượt mà 60fps), bật nếu muốn lướt Flycam
  boardStyle: 'theo-style',    // style bảng thống kê bên phải: theo-style · khung-vang · toi-gian · the-sang
  quizOn: true, quizEveryMin: 3, quizSec: 40, quizPts: 10,   // câu đố lúc MC rảnh: mỗi N phút · trả lời trong M giây · điểm người đúng đầu tiên               // hiệu ứng nhẹ (máy yếu / OBS cũ): tắt nền động, kính mờ, sao chổi
  mcGiftCta: false,            // MC kêu gọi tặng quà + bảng xu→điểm + quà giả (BẬT = như cũ, dễ bị TikTok phạt "chèo kéo quà"; TẮT = chế độ an toàn)
  lastUniqueId: '',
};

export const THEMES = ['mac-dinh', 'son-mai', 'aurora', 'neon', 'hoi-an', 'radar', 'tet', 'giay-co'];
export const BOARDS = ['theo-style', 'khung-vang', 'toi-gian', 'the-sang'];

const RULES = {
  roundMin: v => clamp(v, 1, 60), commentPts: v => clamp(v, 0, 100), likePts: v => clamp(v, 0, 100), followPts: v => clamp(v, 0, 1000),
  giftTiers: v => String(v || '').replace(/[^\d:,; ]/g, '').slice(0, 200) || '1:3,5:30,30:100', fullCoins: v => clamp(v, 0, 1000000), fullPts: v => clamp(v, 0, 10000000), music: v => !!v, musicVol: v => clamp(v, 0, 100),
  voice: () => 'nam',   // chốt 1 giọng Nam Minh
   rate: v => clamp(v, -50, 50), pitch: v => clamp(v, -40, 40), volume: v => clamp(v, 0, 100),
  readFact: v => !!v, greetJoin: v => !!v, idleTalk: v => !!v, idleGapSec: v => clamp(v, 0, 600), returnLight: v => !!v,
  ownerOn: v => !!v, duelOn: v => !!v, duelEveryMin: v => clamp(v, 2, 120), duelSec: v => clamp(v, 20, 300), duelBonus: v => clamp(v, 0, 100000), duelCmtPts: v => clamp(v, 0, 1000), duelLikePts: v => clamp(v, 0, 1000), duelFollowPts: v => clamp(v, 0, 1000),
  giftMap: v => cleanGiftMap(v), giftMenuOn: v => !!v,
  autoPacing: v => !!v, autoPaceSpeed: v => ['slow', 'normal', 'fast'].includes(v) ? v : 'normal', autoPaceGifts: v => !!v,
  theme: v => THEMES.includes(v) ? v : 'mac-dinh', fxLite: v => !!v, lensOn: v => !!v, softZoom: v => !!v, showFps: v => !!v, levelOn: v => !!v, levelTiers: v => String(v||'').replace(/[^\d,]/g,'').slice(0,40) || '10,100,500,2000', overtakeOn: v => !!v, missionOn: v => !!v, missionEveryMin: v => clamp(v, 2, 120), missionSec: v => clamp(v, 20, 300), missionTarget: v => clamp(v, 5, 1000), missionPts: v => clamp(v, 0, 10000), camZoom: v => !!v, map3d: v => !!v, boardStyle: v => BOARDS.includes(v) ? v : 'theo-style',
  quizOn: v => !!v, quizEveryMin: v => clamp(v, 1, 60), quizSec: v => clamp(v, 15, 180), quizPts: v => clamp(v, 0, 10000),
  mcGiftCta: v => !!v, newSessionHours: v => clamp(v, 0, 72), lastUniqueId: v => String(v || '').replace(/[^\w.]/g, '').slice(0, 40),
};
export function applySettings(o){ for (const [k, fn] of Object.entries(RULES)) if (o && k in o) settings[k] = fn(o[k]); }

// bậc quà: "1:3,5:30,30:100" = tặng từ 1 xu được 3 điểm, từ 5 xu được 30 điểm, từ 30 xu được 100 điểm (tính theo tổng xu mỗi lần tặng)
export const tiers = () => String(settings.giftTiers).split(/[,;\s]+/).map(x => x.split(':').map(Number)).filter(([a, b]) => a > 0 && b >= 0).sort((a, b) => a[0] - b[0]);
export function ptsFor(coins){ let p = 0; for (const [min, pts] of tiers()) if (coins >= min) p = pts; return p; }
export const fmtXu = n => n >= 1000 && n % 1000 === 0 ? `${n / 1000} nghìn` : String(n);
