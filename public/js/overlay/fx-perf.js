// Nối bộ điều khiển chất lượng (fx-quality.js) với trình duyệt: gắn data-q lên <html>,
// trả về trần hạt theo mức chất lượng, và (khi URL có ?fps=1) hiện bộ đo FPS.
import { createQuality, PARTICLE_CAPS, isFeedActive } from './fx-quality.js';

const quality = createQuality();
let lastFeedAt = 0;
let samplerRunning = false;

if (typeof document !== 'undefined') {
  document.documentElement.dataset.q = '0';
}

// Cấp dt cho bộ điều khiển; nếu mức đổi thì gắn data-q, ghi log và (khi mức > 0) bật bộ lấy mẫu rảnh.
function feedAndApply(dtMs) {
  const before = quality.level();
  const after = quality.feed(dtMs);
  if (after !== before) {
    document.documentElement.dataset.q = String(after);
    console.info('[fx] chất lượng:', after);
    if (after > 0) startSampler();
  }
}

// Bộ lấy mẫu rảnh: vòng hạt chỉ chạy khi có hạt, nên khi không có pháo hoa thì tự cấp khung
// để mức chất lượng vẫn phục hồi được. Chỉ chạy khi mức > 0 (ở mức 0 không có rAF nào).
function startSampler() {
  if (samplerRunning || typeof requestAnimationFrame === 'undefined') return;
  samplerRunning = true;
  let sTs = 0;
  function tick(ts) {
    if (quality.level() === 0) {
      samplerRunning = false;
      return;
    }
    if (isFeedActive(performance.now(), lastFeedAt)) {
      sTs = 0; // vòng hạt đang cấp khung, không đếm đôi
    } else {
      if (sTs) feedAndApply(ts - sTs);
      sTs = ts;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

export function feedFrame(dtMs) {
  lastFeedAt = performance.now();
  feedAndApply(dtMs);
}

export function particleCap() {
  return document.body?.classList.contains('lite')
    ? PARTICLE_CAPS[PARTICLE_CAPS.length - 1]
    : quality.cap();
}

export function qualityLevel() {
  return quality.level();
}

// Bộ đo FPS: chỉ chạy khi có ?fps=1; nếu không thì không tạo rAF/timer nào.
function startFpsMeter() {
  const el = document.createElement('div');
  el.id = 'fxFps';
  el.style.cssText =
    'position:fixed;top:0;left:0;z-index:9999;padding:4px 10px;' +
    'font:24px monospace;color:#fff;background:rgba(0,0,0,.6);pointer-events:none;';
  el.textContent = 'FPS -- · Q' + quality.level();
  document.body.appendChild(el);

  let frames = 0;
  let last = performance.now();
  function tick(now) {
    frames++;
    const elapsed = now - last;
    if (elapsed >= 500) {
      el.textContent = 'FPS ' + Math.round((frames * 1000) / elapsed) + ' · Q' + quality.level();
      frames = 0;
      last = now;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

if (typeof location !== 'undefined' && typeof document !== 'undefined'
    && new URLSearchParams(location.search).get('fps') === '1') {
  if (document.body) startFpsMeter();
  else document.addEventListener('DOMContentLoaded', startFpsMeter, { once: true });
}
