// Quản lý Chuỗi Combo Quê Hương (Province Combo Fire)
// Khi nhiều người cùng một tỉnh comment dồn dập, ngọn lửa combo sẽ bùng cháy trên bản đồ!
import { $ } from './util.js';
import { P } from './map.js';
import { playSfx } from './audio.js';
import { fxOn } from './fx-options.js';

// Kiểu combo đẹp hơn: chỉ nạp fx-combo.css khi cờ fxOn('combo') bật, gỡ khi tắt. Idempotent, gọi mỗi lần nhận `state`.
export function syncComboStyle() {
  const link = document.getElementById('fx-combo-css');
  if (fxOn('combo')) {
    if (link) return;
    const l = document.createElement('link');
    l.id = 'fx-combo-css';
    l.rel = 'stylesheet';
    l.href = new URL('../../css/fx-combo.css', import.meta.url).href;
    document.head?.appendChild(l);
  } else if (link) link.remove();
}

const combos = new Map(); // ten -> { count, lastAt, timer, el }
const COMBO_TIMEOUT = 5000; // 5 giây không có thêm comment -> tắt chuỗi combo

export function registerCombo(ten) {
  if (!ten || !P[ten]) return;
  const now = Date.now();
  let c = combos.get(ten);

  if (!c || (now - c.lastAt > COMBO_TIMEOUT)) {
    if (c?.timer) clearTimeout(c.timer);
    if (c?.el) c.el.remove();
    c = { count: 1, lastAt: now, timer: null, el: null };
  } else {
    c.count++;
    c.lastAt = now;
  }
  combos.set(ten, c);

  // Bắt đầu bốc lửa từ Combo x3 trở lên
  if (c.count >= 3) {
    updateComboBadge(ten, c);
    playSfx('combo', c.count);
  }

  // Đặt bộ đếm thời gian dập tắt khi ngừng comment
  if (c.timer) clearTimeout(c.timer);
  c.timer = setTimeout(() => {
    removeComboBadge(ten);
  }, COMBO_TIMEOUT);
}

function updateComboBadge(ten, c) {
  const v = P[ten];
  if (!v) return;

  if (!c.el) {
    c.el = document.createElement('div');
    c.el.className = 'combo-badge';
    c.el.innerHTML = `
      <span class="combo-flame">🔥</span>
      <div class="combo-body">
        <span class="combo-prov">${ten.toUpperCase()}</span>
        <span class="combo-num">COMBO x<b>${c.count}</b></span>
      </div>
    `;
    c.el.style.left = v.cx + 'px';
    c.el.style.top = (v.cy - (v.size === 'sm' ? 42 : 54)) + 'px';
    $('#marks').appendChild(c.el);
  } else {
    const numEl = c.el.querySelector('.combo-num b');
    if (numEl) numEl.textContent = c.count;
    c.el.classList.remove('pop');
    void c.el.offsetWidth;
    c.el.classList.add('pop');
  }

  // Nâng cấp cấp bậc ngọn lửa
  c.el.classList.toggle('tier-2', c.count >= 10);
  c.el.classList.toggle('tier-3', c.count >= 25);
  v.path?.classList.toggle('combo-glow', c.count >= 5);

  // Sinh đốm than hồng bay lên
  spawnComboEmber(v.cx, v.cy - 45);
}

function removeComboBadge(ten) {
  const c = combos.get(ten);
  if (!c) return;
  if (c.el) {
    c.el.classList.add('fade-out');
    setTimeout(() => {
      c.el?.remove();
    }, 380);
  }
  if (P[ten]?.path) {
    P[ten].path.classList.remove('combo-glow');
  }
  combos.delete(ten);
}

function spawnComboEmber(x, y) {
  const e = document.createElement('i');
  e.className = 'combo-ember';
  const dx = (Math.random() - 0.5) * 36;
  e.style.left = (x + dx) + 'px';
  e.style.top = y + 'px';
  $('#marks').appendChild(e);
  setTimeout(() => e.remove(), 850);
}

