// Ảnh phát sáng dựng sẵn (64x64) cho đầu hạt: thay shadowBlur vốn rất tốn.
const SIZE = 64;
const cache = new Map();

function toRgb(color) {
  const m = /^#([0-9a-f]{6})$/i.exec(typeof color === 'string' ? color.trim() : '');
  if (!m) return [255, 255, 255];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function glowSprite(color) {
  let c = cache.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d');
  const [r, gg, b] = toRgb(color);
  const grad = g.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE / 2);
  grad.addColorStop(0, `rgba(${r},${gg},${b},1)`);
  grad.addColorStop(0.35, `rgba(${r},${gg},${b},0.55)`);
  grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, SIZE, SIZE);
  cache.set(color, c);
  return c;
}
