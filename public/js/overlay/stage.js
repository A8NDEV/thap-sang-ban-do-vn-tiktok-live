// Lớp Z-0: khung 1080×1920 tự co giãn vừa cửa sổ (OBS / LIVE Studio / Electron) + nền sao.
import { $ } from './util.js';

export function setupStage(){
  const q = new URLSearchParams(location.search);
  if (q.get('bg') === '0' || q.get('bg') === 'transparent') document.body.classList.add('clear');
  const st = $('#stage');
  const fit = () => { const k = Math.min(innerWidth / 1080, innerHeight / 1920); st.style.transform = `scale(${k})`; st.style.left = (innerWidth - 1080 * k) / 2 + 'px'; st.style.top = (innerHeight - 1920 * k) / 2 + 'px'; };
  addEventListener('resize', fit);
  if (window.ResizeObserver) new ResizeObserver(fit).observe(document.body);
  fit();
  // Điện thoại (LIVE bằng điện thoại, kinh nghiệm Quán Nhậu): chạm là vào toàn màn hình (ẩn thanh địa chỉ),
  // lỡ cuộn / phóng to thì kéo khung về chỗ cũ.
  if (matchMedia('(pointer: coarse)').matches) {
    const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
    addEventListener('touchend', () => {
      if (fsEl()) return;
      const el = document.documentElement, p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen?.();
      p?.catch?.(() => {});
    }, { passive: true });
    for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(ev, fit);
    addEventListener('scroll', () => { if (scrollX || scrollY) scrollTo(0, 0); }, { passive: true });
  }
  // nền sao vẽ một lần (tĩnh) — không tốn CPU/GPU mỗi khung hình
  const c = $('#stars').getContext('2d');
  for (let i = 0; i < 260; i++) { const x = Math.random() * 1080, y = Math.random() * 1920, r = Math.random() * 1.4 + .2; c.fillStyle = `rgba(200,220,255,${Math.random() * .6 + .2})`; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
}
