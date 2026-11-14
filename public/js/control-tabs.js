// Trang điều khiển nhiều trang (giống Tiệc Cưới / Sàn Quẩy): thanh tab phía trên, nhớ trang đang xem.
// Chỉ ẩn / hiện các khối .page — mọi id cũ giữ nguyên nên control.js không phải đổi.
const pages = [...document.querySelectorAll('.page')], tabs = [...document.querySelectorAll('#tabs a')];
const KEY = 'tsbd.page';
function show(id){
  if (!pages.some(p => p.dataset.page === id)) id = 'huong-dan';
  for (const p of pages) p.hidden = p.dataset.page !== id;
  for (const t of tabs) t.classList.toggle('on', t.dataset.page === id);
  try { localStorage.setItem(KEY, id); } catch {}
}
addEventListener('hashchange', () => show(location.hash.slice(1)));
let first = location.hash.slice(1);
if (!first) { try { first = localStorage.getItem(KEY) || ''; } catch {} }
show(first);
// chấm báo trên tab: đang live / có quà lạ chưa có giá
const st = document.getElementById('st'), tabLive = tabs.find(t => t.dataset.page === 'huong-dan');
new MutationObserver(() => tabLive.classList.toggle('live', st.classList.contains('connected'))).observe(st, { attributes: true });
