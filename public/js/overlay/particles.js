// Hệ thống hạt pháo hoa & chấn động màn hình (Canvas 2D tăng tốc phần cứng)
// Tự động dừng requestAnimationFrame khi hết hạt → 0% CPU khi rảnh.
import { $ } from './util.js';

let canvas = null, ctx = null;
const particles = [];
let animId = null;

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

export function initParticles(el) {
  canvas = el;
  if (!canvas) return;
  ctx = canvas.getContext('2d');
}

class Particle {
  constructor(x, y, color, speed, angle, gravity = 0.14, drag = 0.96, size = 3.5, decay = 0.016, spark = false) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.gravity = gravity;
    this.drag = drag;
    this.size = size;
    this.alpha = 1;
    this.decay = decay;
    this.spark = spark;
    this.trail = [];
  }

  update() {
    this.trail.push({ x: this.x, y: this.y, alpha: this.alpha });
    if (this.trail.length > 5) this.trail.shift();

    this.vx *= this.drag;
    this.vy *= this.drag;
    this.vy += this.gravity;
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= this.decay;
  }

  draw(c) {
    if (this.alpha <= 0) return;

    // Vệt đuôi sáng
    if (this.trail.length > 1) {
      c.beginPath();
      c.moveTo(this.trail[0].x, this.trail[0].y);
      for (let i = 1; i < this.trail.length; i++) {
        c.lineTo(this.trail[i].x, this.trail[i].y);
      }
      c.strokeStyle = this.color;
      c.lineWidth = Math.max(1, this.size * 0.6);
      c.globalAlpha = Math.max(0, this.alpha * 0.4);
      c.stroke();
    }

    // Hạt chính phát sáng
    c.beginPath();
    c.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    c.fillStyle = this.color;
    c.globalAlpha = Math.max(0, this.alpha);
    c.shadowBlur = this.spark ? 14 : 6;
    c.shadowColor = this.color;
    c.fill();
    c.shadowBlur = 0;
  }
}

function loop() {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.update();
    p.draw(ctx);
    if (p.alpha <= 0) {
      particles.splice(i, 1);
    }
  }
  ctx.globalAlpha = 1;

  if (particles.length > 0) {
    animId = requestAnimationFrame(loop);
  } else {
    animId = null;
  }
}

function startLoop() {
  if (!animId) {
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
  const pal = PALETTES[paletteName] || PALETTES.gold;
  for (let i = 0; i < count; i++) {
    const angle = rnd(0, Math.PI * 2);
    const speed = rnd(power * 0.25, power);
    const col = pick(pal);
    const decay = rnd(0.012, 0.024);
    const size = rnd(2.5, 4.5);
    particles.push(new Particle(x, y, col, speed, angle, 0.12, 0.95, size, decay, true));
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

// Rung chấn màn hình
let shakeT = null;
export function screenShake(level = 'sm') {
  const st = $('#stage');
  if (!st) return;
  st.classList.remove('shake-sm', 'shake-lg');
  void st.offsetWidth;
  st.classList.add(level === 'lg' ? 'shake-lg' : 'shake-sm');
  clearTimeout(shakeT);
  shakeT = setTimeout(() => st.classList.remove('shake-sm', 'shake-lg'), level === 'lg' ? 650 : 380);
}

// Hạt stardust bay theo rồng vàng
export function dragonSparkles(x, y, n = 8) {
  for (let i = 0; i < n; i++) {
    const angle = rnd(0, Math.PI * 2);
    const speed = rnd(2, 8);
    const col = pick(PALETTES.gold);
    particles.push(new Particle(x, y, col, speed, angle, 0.05, 0.94, rnd(2.5, 4.5), 0.03, true));
  }
  startLoop();
}

