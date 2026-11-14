// Chế độ an toàn TikTok (tắt "MC kêu gọi tặng quà"): nạp CSS ẩn thực đơn quà / thẻ quà khi <html data-safe="1">.
if (typeof document !== 'undefined' && !document.getElementById('fx-safe-css')) {
  const link = document.createElement('link');
  link.id = 'fx-safe-css';
  link.rel = 'stylesheet';
  link.href = new URL('../../css/fx-safe.css', import.meta.url).href;
  document.head?.appendChild(link);
}
