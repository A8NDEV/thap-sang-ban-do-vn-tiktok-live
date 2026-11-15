// Bảng xếp hạng người tặng + phát hiện "vượt hạng". Thuần: không DOM, không Node API.

// donors: { [uid]: { name, avatar, coins } } -> mảng hàng mới, không đột biến input.
export function rankList(donors, n = 10) {
  const limit = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 10;
  if (!donors || typeof donors !== 'object') return [];
  const rows = [];
  for (const uid of Object.keys(donors)) {
    const d = donors[uid];
    if (!d || typeof d !== 'object') continue;
    if (typeof d.coins !== 'number' || !Number.isFinite(d.coins) || d.coins <= 0) continue;
    rows.push({
      uid,
      name: typeof d.name === 'string' ? d.name : '',
      avatar: typeof d.avatar === 'string' ? d.avatar : '',
      coins: d.coins,
    });
  }
  rows.sort((a, b) =>
    b.coins - a.coins ||
    a.name.localeCompare(b.name) ||
    (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
  return rows.slice(0, limit);
}

const brief = (r) => ({ uid: r.uid, name: r.name, avatar: r.avatar || '' });

// before/after: kết quả rankList. Trả null nếu không có tiến bộ hoặc ngoài top maxRank.
export function detectOvertake(before, after, uid, maxRank = 5) {
  const b = Array.isArray(before) ? before : [];
  const a = Array.isArray(after) ? after : [];
  const max = Number.isFinite(maxRank) ? maxRank : 5;
  const idx = a.findIndex((r) => r && r.uid === uid);
  if (idx < 0) return null;
  const rank = idx + 1;
  if (rank > max) return null;
  const oldIdx = b.findIndex((r) => r && r.uid === uid);
  if (oldIdx >= 0 && oldIdx + 1 <= rank) return null;
  const me = a[idx];
  let passed = null;
  const below = a[idx + 1];
  if (below) {
    if (oldIdx < 0) passed = brief(below);
    else {
      const belowOld = b.findIndex((r) => r && r.uid === below.uid);
      if (belowOld >= 0 && belowOld < oldIdx) passed = brief(below);
    }
  }
  // hòa xu không phải vượt: chỉ tính khi xu mới LỚN HƠN hẳn xu người bị vượt (thứ tự hòa chỉ do tên/uid)
  if (passed && !(me.coins > below.coins)) passed = null;
  if (oldIdx >= 0 && !passed) return null;   // đã có trong bảng mà không vượt ai thật sự (chỉ hòa xu): không có cảnh
  return { rank, passed };
}
