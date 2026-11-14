// Kho hạt có trần: cấp phát sẵn `max` hạt, tái sử dụng, không tạo rác mỗi khung hình.
// Module thuần: không import Node/DOM.

function reset(p) {
  p.x = 0; p.y = 0; p.px = 0; p.py = 0; p.vx = 0; p.vy = 0;
  p.alpha = 1; p.decay = 0; p.size = 1; p.gravity = 0; p.drag = 1;
  p.color = ''; p.spark = false;
  return p;
}

export function createPool(max) {
  const total = Math.max(0, Math.floor(Number.isFinite(max) ? max : 0));
  const free = [];
  for (let i = 0; i < total; i++) free.push(reset({}));
  const live = [];
  let cap = total;

  return {
    add(init) {
      if (live.length >= cap || free.length === 0) return false;
      const p = reset(free.pop());
      init(p);
      live.push(p);
      return true;
    },
    setCap(n) {
      if (typeof n !== 'number' || !Number.isFinite(n)) return;
      cap = Math.min(total, Math.max(0, Math.floor(n)));
    },
    cap() {
      return cap;
    },
    forEach(fn) {
      // Duyệt từ cuối về đầu: hoán đổi-xóa an toàn, không bỏ sót hạt nào.
      for (let i = live.length - 1; i >= 0; i--) {
        const p = live[i];
        if (fn(p) === false) {
          const last = live.pop();
          if (i < live.length) live[i] = last;
          free.push(p);
        }
      }
    },
    get count() {
      return live.length;
    },
  };
}
