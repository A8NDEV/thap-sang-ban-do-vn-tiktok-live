// TẦNG 3 — "Chủ tỉnh": người tặng nhiều xu nhất cho mỗi tỉnh, giữ danh hiệu qua các buổi live cho tới khi bị vượt.
import { owners, saveOwners } from './store.mjs';

// cộng xu; trả { prev } nếu người này vừa giành ngôi (prev = tên Chủ tỉnh cũ, '' nếu tỉnh chưa có chủ)
export function addOwnerCoins(ten, uid, name, avatar, coins){
  if (!ten || !(coins > 0) || String(uid).startsWith('demo')) return null;   // người xem giả của chế độ chạy thử không giữ ngôi
  const T = owners.totals[ten] ||= {};
  const r = T[uid] ||= { name, avatar: '', coins: 0 };
  r.name = name; if (avatar) r.avatar = avatar; r.coins += coins;
  const cur = owners.owner[ten], curRec = cur && T[cur];
  let won = null;
  if (cur !== uid && (!curRec || r.coins > curRec.coins)) { owners.owner[ten] = uid; won = { prev: curRec ? curRec.name : '' }; }
  const ids = Object.keys(T);   // giữ tối đa 300 người mỗi tỉnh
  if (ids.length > 300) ids.sort((a, b) => T[a].coins - T[b].coins).slice(0, ids.length - 300).forEach(k => { if (k !== owners.owner[ten]) delete T[k]; });
  saveOwners();
  return won;
}
export function ownersView(){
  const out = {};
  for (const [ten, uid] of Object.entries(owners.owner)) { const r = owners.totals[ten]?.[uid]; if (r) out[ten] = { name: r.name, avatar: r.avatar, coins: r.coins }; }
  return out;
}
export function resetOwners(){ owners.totals = {}; owners.owner = {}; saveOwners(); }
