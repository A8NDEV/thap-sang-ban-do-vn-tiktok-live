// Hệ thống hạt pháo hoa & chấn động màn hình (Canvas 2D tăng tốc phần cứng)
// Tự động dừng requestAnimationFrame khi hết hạt → 0% CPU khi rảnh.
import { $ } from './util.js';
import { createPool } from './fx-pool.js';
import { glowSprite } from './fx-glow.js';
import { frameScale } from './fx-quality.js';
import { feedFrame, particleCap, qualityLevel } from './fx-perf.js';

let canvas = null, ctx = null;
let animId = null;

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

export function initParticles(el) {
  canvas = el;
  if (!canvas) return;
  ctx = canvas.getContext('2d');
}

const pool = createPool(1500);
let lastTs = 0;

const SCALE = [1, 0.6, 0.35];
function scaled(n) {
  if (!(n >= 1)) return 0;
  return Math.max(1, Math.round(n * (SCALE[qualityLevel()] ?? 1)));
}

// init chỉ gán số/chuỗi, không bao giờ ném lỗi (hạt đã lấy từ kho sẽ bị rò nếu ném).
function spawn(x, y, color, speed, angle, gravity, drag, size, decay) {
  pool.add(p => {
    p.x = x; p.y = y; p.px = x; p.py = y;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.color = color; p.gravity = gravity; p.drag = drag;
    p.size = size; p.alpha = 1; p.decay = decay; p.spark = true;
  });
}

const TRAIL_K = 0.22;
let sc = 1, trailK = TRAIL_K;

function step(p) {
  // Điểm đuôi bám theo đầu hạt (làm mượt, độc lập tốc độ khung), vẽ vệt bằng một đoạn thẳng.
  p.px += (p.x - p.px) * trailK;
  p.py += (p.y - p.py) * trailK;
  const d = sc === 1 ? p.drag : Math.pow(p.drag, sc);
  p.vx *= d;
  p.vy *= d;
  p.vy += p.gravity * sc;
  p.x += p.vx * sc;
  p.y += p.vy * sc;
  p.alpha -= p.decay * sc;
  if (p.alpha <= 0) return false;

  ctx.strokeStyle = p.color;
  ctx.lineWidth = Math.max(1.5, p.size * 0.8);
  ctx.globalAlpha = Math.max(0, p.alpha * 0.55);
  ctx.beginPath();
  ctx.moveTo(p.px, p.py);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();

  const r = p.size * (p.spark ? 3.2 : 2.2);
  ctx.globalAlpha = Math.max(0, p.alpha);
  ctx.drawImage(glowSprite(p.color), p.x - r, p.y - r, 2 * r, 2 * r);

  // Lõi trắng sáng
  const c = p.size;
  ctx.globalAlpha = Math.max(0, p.alpha * 0.85);
  ctx.drawImage(glowSprite('#ffffff'), p.x - c, p.y - c, 2 * c, 2 * c);
  return true;
}

function loop(ts) {
  if (!ctx || !canvas) { animId = null; lastTs = 0; return; }
  // Chỉ nạp khoảng thời gian giữa hai khung liên tiếp; khung đầu của đợt bắn thì bỏ qua.
  if (lastTs) {
    const dt = ts - lastTs;
    feedFrame(dt);
    sc = frameScale(dt);
  } else {
    sc = 1;
  }
  trailK = 1 - Math.pow(1 - TRAIL_K, sc);
  lastTs = ts;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'lighter';
  pool.forEach(step);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  if (pool.count > 0) {
    animId = requestAnimationFrame(loop);
  } else {
    animId = null;
    lastTs = 0;
  }
}

function startLoop() {
  if (!animId) {
    lastTs = 0;
    animId = requestAnimationFrame(loop);
  }
}

const PALETTES = {
  gold: ['#fff9c4', '#ffe082', '#ffd54f', '#ffca28', '#ffa000', '#ff6f00', '#ffffff'],
  royal: ['#ffd700', '#ff007f', '#76ff03', '#00e5ff', '#d500f9', '#ffffff'],
  fire: ['#ff1744', '#ff5252', '#ff9100', '#ffd700', '#ffffff'],
  neon: ['#00e5ff', '#18ffff', '#e040fb', '#7c4dff', '#ffffff'],
  rose: ['#ff4081', '#f50057', '#ff80ab', '#ffffff', '#ffd54f']
};

export function launchFirework(x, y, paletteName = 'gold', count = 65, power = 15) {
  if (!ctx) return;
  pool.setCap(particleCap());
  const pal = PALETTES[paletteName] || PALETTES.gold;
  const n = scaled(count);
  for (let i = 0; i < n; i++) {
    const angle = rnd(0, Math.PI * 2);
    const speed = rnd(power * 0.25, power);
    const col = pick(pal);
    const decay = rnd(0.012, 0.024);
    const size = rnd(2.5, 4.5);
    spawn(x, y, col, speed, angle, 0.12, 0.95, size, decay);
  }
  startLoop();
}

export function launchFireworkCluster(x, y, count = 3, palette = 'gold') {
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const ox = x + rnd(-100, 100);
      const oy = y + rnd(-90, 90);
      const pal = i === 1 ? 'royal' : i === 2 ? 'fire' : palette;
      launchFirework(ox, oy, pal, rnd(55, 80), rnd(13, 18));
    }, i * 220);
  }
}

export function launchMassiveFireworks() {
  const centers = [
    [540, 450], [320, 700], [720, 650], [450, 950],
    [650, 1200], [380, 1400], [520, 1600], [540, 750]
  ];
  centers.forEach(([x, y], i) => {
    setTimeout(() => {
      const pals = ['gold', 'royal', 'fire', 'neon', 'rose'];
      launchFirework(x + rnd(-40, 40), y + rnd(-40, 40), pals[i % pals.length], 80, 18);
    }, i * 260);
  });
}

// Rung chấn màn hình. KHÔNG dùng animation CSS lên #stage: stage.js đã đặt transform: scale(k) để khung vừa cửa sổ,
// animation CSS sẽ GHI ĐÈ transform đó nên khung phóng về 1080×1920 và dính góc trên-trái trong lúc rung.
// Ở đây ghép phép dịch chuyển SAU phép scale hiện tại (WAAPI), nên khung luôn giữ đúng kích thước.
const SHAKE = {
  sm: { ms: 380, ease: 'ease-out', f: [[0, 0, 1], [-4, 3, 1], [4, -3, 1], [-3, -1, 1], [2, 2, 1], [0, 0, 1]], at: [0, .2, .4, .6, .8, 1] },
  lg: { ms: 650, ease: 'cubic-bezier(.36,.07,.19,.97)', f: [[0, 0, 1], [-10, 7, 1.008], [9, -8, 1.008], [-7, 5, 1.004], [6, -4, 1.002], [-4, 2, 1], [3, -1, 1], [0, 0, 1]], at: [0, .15, .3, .45, .6, .75, .9, 1] },
};
let shakeAnim = null;
export function screenShake(level = 'sm') {
  const st = $('#stage');
  if (!st || typeof st.animate !== 'function') return;
  try { shakeAnim?.cancel(); } catch { /* bỏ qua */ }
  const cfg = level === 'lg' ? SHAKE.lg : SHAKE.sm;
  const base = st.style.transform || '';
  const frames = cfg.f.map(([x, y, k], i) => ({ transform: `${base} translate(${x}px, ${y}px)${k !== 1 ? ` scale(${k})` : ''}`, offset: cfg.at[i] }));
  try {
    const a = st.animate(frames, { duration: cfg.ms, easing: cfg.ease });
    shakeAnim = a;
    a.onfinish = a.oncancel = () => { if (shakeAnim === a) shakeAnim = null; };
  } catch { shakeAnim = null; }
}

// Hạt stardust bay theo rồng vàng
export function dragonSparkles(x, y, n = 8) {
  if (!ctx) return;
  pool.setCap(particleCap());
  n = scaled(n);
  for (let i = 0; i < n; i++) {
    const angle = rnd(0, Math.PI * 2);
    const speed = rnd(2, 8);
    const col = pick(PALETTES.gold);
    spawn(x, y, col, speed, angle, 0.05, 0.94, rnd(2.5, 4.5), 0.03);
  }
  startLoop();
}

