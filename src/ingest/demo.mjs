// TẦNG 1 — nguồn sự kiện thử nghiệm: người xem giả (demo tự động) và sự kiện gõ tay từ bảng điều khiển (sim).
// Người dùng chịu trách nhiệm không bật khi đang LIVE thật (TikTok có thể coi là tương tác giả).
import { broadcast, addLog, pick, clamp } from '../core/bus.mjs';
import { norm } from './sanitize.mjs';
import { ALIAS } from '../domain/provinces.mjs';
import { onChat, onLike, onGift, onJoin, onFollow } from '../domain/game.mjs';
import { markRealActivity } from './auto-pacing.mjs';

const DEMO_NAMES = ['anhbabich', 'Thu Trang', 'minhtuan.99', 'Hoa Mai', 'bé Na', 'Long Hải', 'Quỳnh Như', 'tuan.dev', 'Ngọc Ánh', 'Bảo Khang', 'mèo mập', 'Hà Linh', 'Phúc Lộc', 'Vy Vy', 'Đức Anh', 'Kim Chi', 'Tấn Phát', 'Mỹ Duyên'];
const DEMO_SAY = () => pick([...ALIAS.map(a => a.a.trim()), 'sài gòn nè', 'quê mình Nghệ An', 'Đà Lạt mộng mơ', 'em ở Bình Dương', 'hello cả nhà', 'quê tôi Quy Nhơn', 'Hà Nội ơi', 'Cần Thơ gạo trắng nước trong', 'hoàng sa trường sa là của Việt Nam']);
let demoTimer = null;
export const demoMsg = () => ({ t: 'demo', on: !!demoTimer });
export function demo(on){
  clearInterval(demoTimer); demoTimer = null;
  if (on) demoTimer = setInterval(() => {
    const i = Math.floor(Math.random() * DEMO_NAMES.length), uid = 'demo' + i, nm = DEMO_NAMES[i], r = Math.random();
    if (r < .56) onChat(uid, nm, DEMO_SAY(), '');
    else if (r < .82) onLike(uid, nm, 1 + Math.floor(Math.random() * 15), '');
    else if (r < .92) onFollow(uid, nm, '');
    else { const [g, c] = pick([['Hoa hồng', 1], ['Hoa hồng', 1], ['Tim ngón tay', 5], ['Bánh donut', 30]]); onGift(uid, nm, g, 1 + Math.floor(Math.random() * 3), c, ''); }
  }, 2500);
  broadcast(demoMsg(), 'control');
  addLog(on ? '▶️ Bật chạy thử: người xem giả bình luận, thả tim, follow, tặng quà' : '⏹️ Tắt chạy thử');
}

// sự kiện thử gõ tay ở bảng điều khiển (mã người xem bắt đầu bằng sim_)
export function simulate(kind, p = {}){
  markRealActivity();
  const nm = String(p.name || 'Khách').slice(0, 30), uid = 'sim_' + norm(nm).trim().replace(/ /g, '_');
  if (kind === 'chat') onChat(uid, nm, String(p.text || ''), '');
  else if (kind === 'like') onLike(uid, nm, clamp(p.n || 10, 1, 999), '');
  else if (kind === 'follow') onFollow(uid, nm, '');
  else if (kind === 'gift') onGift(uid, nm, String(p.gift || 'Hoa hồng').slice(0, 40), 1, clamp(p.coins || 1, 1, 100000), '', String(p.giftId || '').replace(/\D/g, '').slice(0, 20));
  else if (kind === 'join') onJoin(uid, nm, '');
  else return false;
  return true;
}
