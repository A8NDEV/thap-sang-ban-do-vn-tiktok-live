# Thiết kế nhỏ: thẻ "Người tặng quà nhiều nhất"

Ngày: 2026-11-14 · Yêu cầu của chủ kênh: đổi thẻ "QUÊ NHẬN NHIỀU QUÀ" thành người tặng quà nhiều nhất (thúc đẩy tặng quà hơn xếp hạng quê).

## Hiện trạng
- Overlay: `public/overlay.html` có `<div class="card" id="giftCard"><h3>QUÊ NHẬN NHIỀU QUÀ <small>🎁</small></h3><div class="rows" id="gifts"></div></div>`; `public/js/overlay/render.js` (đoạn "// quà") vẽ từ `s.gifts` (quê + xu).
- Máy chủ: `src/domain/game.mjs` `snapshot()` gửi `gifts` (top 5 quê, `S.gifts`) và `donors` (top 3 người tặng, `S.donors`) — `donors` dùng cho bục "VINH DANH" dưới cùng (`#podBars`) và PHẢI giữ nguyên.
- `S.donors[uid] = { name, avatar, coins }` chỉ có người thật (người xem ảo `auto_`/`demo` bị loại ở `onGift`).

## Thiết kế đã chốt
1. Hàm thuần mới `topGifters(donors, n = 5)` trong file mới `src/domain/donors.mjs`: nhận object `S.donors` (hoặc `undefined`), trả mảng tối đa `n` phần tử `{ name, avatar, coins }` sắp xếp `coins` giảm dần (đồng hạng: giữ thứ tự theo `name` tăng dần để ổn định), **bỏ** mục có `coins <= 0` hoặc không phải số, **không** trả `uid` hay trường nào khác. Có test `tests/donors.test.mjs` (`node --test`).
2. `game.mjs` `snapshot()`: thêm trường `topGifters: topGifters(S.donors, 5)`. Không đổi `donors`, `gifts` hay trường nào khác.
3. `overlay.html`: tiêu đề thẻ thành `TOP NGƯỜI TẶNG QUÀ <small>🎁</small>` (phải vừa 1 dòng trong thẻ rộng 318px; id `giftCard`, `gifts` giữ nguyên).
4. `render.js`: đoạn "// quà" vẽ từ `s.topGifters || []`: mỗi hàng `<div class="row" data-id="<tên đã esc>">` gồm thanh `fill` (độ rộng theo xu / xu lớn nhất trong top), `rk` (hạng), một ô ảnh đại diện `.gav` (dùng hàm `avatar(el, name, url)` đã có ở `util.js`), `pn` (tên, đã `esc`), `pt` (xu). Trống: `Chưa có quà.<br>Tặng quà để lên bảng nhé 🎁`. Server cũ không gửi `topGifters` thì hiện trạng thái trống, không lỗi.
5. CSS: file mới `public/css/gifters.css` (link trong `overlay.html` ngay sau `fx-perf.css`) cho `#giftCard .gav` (tròn 30×30, viền như các ảnh đại diện khác), chỉnh `#giftCard .row` đủ chỗ cho ảnh trong chiều cao 44px; không sửa `overlay.css`/`themes*.css`.
6. Giữ nguyên bục `VINH DANH` ở dưới (top 3 vẫn hiện ở đó). Không sửa luật chơi, `auto-pacing`, bản quyền.

## Không làm
Không đổi `S.gifts` (vẫn tích lũy cho "Chủ tỉnh" và rương), không thêm cài đặt, không đụng thư viện.

## Kiểm tra
Test thuần cho `topGifters`; chủ kênh/controller kiểm tra hình ảnh trong trình duyệt bằng trạng thái giả có `topGifters`.
