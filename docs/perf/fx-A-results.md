# Kết quả đo hiệu năng pháo hoa (fx-A)

> Lưu ý: đây là số **Chrome trên máy dev, chỉ để so sánh tương đối** giữa các mốc, không phải hiệu năng thực tế trên máy phát live.

Cách đo: `node tools/serve-static.mjs` rồi mở `http://127.0.0.1:5173/tools/fx-bench.html`; kịch bản 12 giây, kết quả ở `window.__bench`.

| Mốc | avgFps | lowFps1pct | maxFrameMs | Ghi chú |
| --- | --- | --- | --- | --- |
| Gốc (lần 1) | 7.76 | 1.13 | 1236 | 102 khung / 12 giây |
| Gốc (lần 2) | 5.11 | 1.62 | 618 | 62 khung |
| Gốc (lần 3) | 4.80 | 1.60 | 625 | 58 khung |
| **Gốc (trung bình)** | **5.9** | **1.4** | **~620–1236** | Chrome 15x trên Windows, cửa sổ 1812×797, dpr ≈ 1.06, cổng 5174 |

Nhận xét: bản gốc chạy rất giật trong kịch bản "mưa quà" (dưới 8 FPS). Đây là kịch bản nặng (8 chùm × 80 hạt liên tục + 2 chùm 5 pháo mỗi 600ms) nên là trường hợp xấu nhất, nhưng cho thấy `shadowBlur` + vệt đuôi cấp phát mỗi khung thực sự là nút thắt.

## Sau Task 4 (bỏ shadowBlur, kho hạt + ảnh phát sáng, mô phỏng theo thời gian thực, lõi trắng)

| Mốc | avgFps | lowFps1pct | maxFrameMs | Ghi chú |
| --- | --- | --- | --- | --- |
| Sau Task 4 (lần 1) | 81.62 | 37.62 | 76.4 | 981 khung |
| Sau Task 4 (lần 2) | 80.80 | 31.21 | 132.0 | 970 khung |
| Sau Task 4 (lần 3) | 77.96 | 25.27 | 131.9 | 937 khung |
| **Sau Task 4 (trung bình)** | **80.1** | **31.4** | **76–132** | so với gốc: 5.9 / 1.4 / 620–1236 |

- Màn hình đo có tần số quét cao (khoảng 7–15 ms mỗi khung ở các lần chạy khác nhau), nên avgFps không bị chặn ở 60.
- Trước khi sửa "mô phỏng theo thời gian thực" (fix round 1), bản đầu tiên của Task 4 đo được 115 / 33 / 215 và 77 / 24 / 201; tăng FPS nhưng hạt chết sớm trên màn hình tần số cao. Đã sửa: bước mô phỏng nhân theo `frameScale(dt)`.
- So sánh hình ảnh cùng thời điểm (400 ms sau khi bắn 3 chùm): hình dạng, bán kính, lõi sáng và vệt đuôi gần như bản cũ.
- Kiểm tra rảnh: 0 lệnh `requestAnimationFrame` trong 3 giây sau khi hết hạt (vòng lặp tự dừng).

## Task 6: giảm lớp CSS nặng (chỉ giữ thay đổi đo được là có lợi)

**Cách đo:** mở `overlay.html` với trạng thái giả đầy đủ (34 tỉnh sáng, có marker avatar), bắn pháo hoa nhẹ 30 hạt mỗi 250 ms, mỗi biến thể đo 5 giây, ghi thời gian khung trung bình / p99 / lớn nhất (ms).

| Biến thể | avg (ms) | p99 (ms) | max (ms) |
| --- | --- | --- | --- |
| Gốc | 16.66 | 28 | 28 |
| A: tắt `backdrop-filter` của `.card` + `#banner` | 16.69 | 27.8 | 34.7 |
| B: ẩn `.sea-wave` + `.sea-coast` | 14.1 | 27.8 | 41.5 |
| C: A + B | 14.53 | 21.2 | 27.8 |
| D: tắt lắc `#tilt` | 13.42 | 21.1 | 76.3 |
| Gốc (lần 2) | 14.6 | 21.2 | 28 |

**Trung thực về số liệu:** hai lần chạy gốc giống hệt nhau chênh khoảng 2 ms, nên không biến thể A/B/D nào cho thấy mức cải thiện vượt quá nhiễu trên máy này. Các số trên đo bằng Chrome có tăng tốc GPU, có thể đánh giá thấp lợi ích thật trong TikTok LIVE Studio (nơi có thể render không có GPU).

**Quyết định:**
- A (bỏ `backdrop-filter` ở `.card`, `#banner`): bỏ luôn ở mọi board. Không đo được lợi FPS trên máy dev, nhưng ảnh phóng to có/không blur giống hệt nhau ở board mặc định; chi phí GPU của kính mờ có thể lớn hơn khi LIVE Studio không có tăng tốc GPU. Các board `toi-gian`, `khung-vang`, `the-sang` vốn đã tắt blur trong `themes.css` nên không bị ảnh hưởng (computed `backdrop-filter` là `none` cho `.card` và `#banner` ở cả bốn board).
- B (ẩn sóng/bờ biển) và D (tắt lắc `#tilt`): chỉ giữ làm luật degrade (`html[data-q="1"|"2"]`) vì đổi hình ảnh; chỉ áp dụng khi máy đang quá tải. Luật degrade `.card`/`#banner` ở Q2 đã bị bỏ vì thừa (blur đã tắt ở mọi board).
- Chuyển đổi `box-shadow` keyframes (`glowF`, `avatarGlow`, `#lastCard.hot`): bỏ qua. Không có số đo nào chứng minh có lợi, có rủi ro đổi hình ảnh. Sẽ xem lại nếu số `?fps=1` thu được trong LIVE Studio cho thấy cần thiết.

## Hạn chế đã biết

- (a) Chỉ kiểm tra board mặc định và bốn board kiểu bảng. 7 gói theme còn lại do máy chủ ứng dụng có bản quyền phục vụ nên chưa chạy thử; hãy xem lướt từng theme một lần trong LIVE Studio.
- (b) Lệch so với dòng 64 của spec: blur luôn bật đã bị bỏ mà không thay bằng nền đặc (thẻ vốn đã khoảng 0.82–0.98 đục và ảnh phóng to so sánh giống hệt); các keyframes `box-shadow` (`glowF`, `avatarGlow`, `#lastCard.hot`) chưa chuyển sang `opacity` vì không có số đo nào chứng minh cần. Sẽ xem lại nếu số `?fps=1` từ LIVE Studio cho thấy cần thiết.
- (c) Trộn cộng (`lighter`) có thể bão hòa về trắng ở các loạt pháo rất dày; chưa thấy xảy ra, nên kiểm tra đỉnh điểm của "pháo hoa hàng loạt" một lần trong LIVE Studio.
- (d) Phục hồi chất lượng nay còn chạy qua bộ lấy mẫu rảnh (chỉ khi mức > 0), nên các luật degrade được nhả sau khoảng 10 giây khung mượt mỗi mức, kể cả khi không có pháo hoa trên màn hình.
