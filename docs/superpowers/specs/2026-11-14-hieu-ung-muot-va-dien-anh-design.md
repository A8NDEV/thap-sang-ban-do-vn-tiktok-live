# Thiết kế: Hiệu ứng mượt (A) rồi hiệu ứng điện ảnh (B)

Ngày: 2026-11-14 · Trạng thái: **chờ chủ dự án duyệt**

## Ý định và lý do

Chủ dự án là streamer, dùng overlay "Thắp Sáng Bản Đồ Việt Nam" để kéo tương tác và nhận quà. Điều họ cần nhất lúc này là **hiệu ứng bắt mắt và chạy mượt**, vì hiệu ứng đẹp lúc có quà là thứ khiến người xem muốn tặng thêm và quay clip lại. Overlay hiển thị trong **TikTok LIVE Studio** trên máy tính (cấu hình máy chưa biết).

## Hiện trạng (đọc code, **chưa đo**)

- `public/js/overlay/particles.js`: canvas 1080×1920; mỗi hạt đặt `shadowBlur` + tạo mảng vệt đuôi mới mỗi khung; `launchMassiveFireworks` = 8 chùm × 80 hạt. Nghi ngờ gây giật và tạo rác bộ nhớ.
- `public/css/overlay.css`: `.card` luôn có `backdrop-filter: blur(4px)`, banner blur 10px, vài lớp `filter: blur(18–24px)` + `mix-blend-mode: screen`, ~50 `box-shadow`, 62 `@keyframes`. Nghi ngờ nặng khi nền bản đồ chuyển động.
- `public/js/overlay/fx.js`: hiệu ứng quà chủ yếu là emoji bay; số hiệu ứng chạy cùng lúc không bị giới hạn (chỉ hàng đợi camera tối đa 6).
- Có sẵn: chế độ nhẹ `fxLite` (chỉnh tay), camera lia, sóng xung kích, cột sáng, vương miện rơi, `launchLanternFestival`.

## Mục tiêu

**A — Mượt (làm trước)**
1. Có **số liệu đo** trước/sau: trang đo FPS riêng + bộ hiển thị FPS trong overlay (`?fps=1`) để chủ dự án đọc FPS thật bên trong LIVE Studio.
2. Pháo hoa / hạt không còn `shadowBlur` theo từng hạt; vệt đuôi và hạt tái sử dụng (không cấp phát mới mỗi khung); có **trần số hạt**.
3. **Tự giảm chất lượng** khi khung hình tụt (không cần chủ dự án bật `fxLite` bằng tay) và tự phục hồi khi ổn định.
4. Bỏ blur nền luôn bật ở các thẻ / banner (thay bằng nền đặc đổ gradient giống nhìn), tránh animate `box-shadow` / `filter` (chỉ animate `transform` và `opacity`).

**B — Điện ảnh (làm sau khi A đo xong)**
1. **Tỉnh sáng lần đầu:** đèn lồng và tàn lửa bay lên từ tỉnh (hợp chủ đề "thắp đèn").
2. **Quà lớn (≥ 100 xu):** dải đen điện ảnh trên / dưới, zoom chậm, tia sáng, tên quà chữ lớn.
3. **Rồng vẽ thật** (canvas, vệt sáng) thay cho emoji 🐉.
4. **Quà liên tiếp leo thang:** càng nhiều quà liền nhau, màu và mật độ hạt càng mạnh (có trần).

## Không phải mục tiêu

- Không sửa / gỡ `auto-pacing`, bản quyền, kích hoạt key, gói giao diện tải từ máy chủ.
- Không tạo theme mới; không thêm thư viện npm; không đổi luật chơi (điểm, vòng đua...).
- Không làm mục tiêu tim/xu, chuỗi ngày, tổng kết (đã tạm hoãn, xem `2026-11-14-muc-tieu-chung-va-giu-chan-design.md`).

## Phản mục tiêu (coi như thất bại dù chạy được)

- Hiệu ứng mới **nặng hơn** hiệu ứng cũ trên máy yếu, hoặc tốn CPU khi rảnh (hiện tại hạt tự dừng khi hết — phải giữ).
- Nhìn **xấu hơn** bản hiện tại (mất độ sáng, độ "lung linh").
- **Nhấp nháy toàn màn hình nhanh** (>3 lần/giây) hoặc chớp trắng gắt có thể gây khó chịu / co giật nhạy sáng.
- Làm hỏng hiệu ứng ở 8 theme hiện có hoặc `fxLite`.

## Ràng buộc

- Giữ nguyên chữ ký hàm công khai đang được gọi: `launchFirework`, `launchFireworkCluster`, `launchMassiveFireworks`, `dragonSparkles`, `screenShake`, `giftFx`, `banner`, `shot`, `nationWide`... để `main.js` và theme gói tải về (`/style/<id>.js`) không vỡ.
- Hiệu ứng mới đặt trong **file mới** (ví dụ `public/js/overlay/fx-cinema.js`, `fx-glow.js`, `perf.js`, `public/css/fx-cinema.css`); sửa file cũ tối thiểu.
- Tôn trọng `isLite()`: chế độ nhẹ không chạy hiệu ứng B nặng.
- Logic thuần (trần hạt, bộ điều khiển chất lượng tự động, quy tắc leo thang) phải có test `node --test` không cần trình duyệt. Phần hình ảnh kiểm tra bằng trình duyệt thật.
- Máy chủ **không được khởi động** để thử (sẽ tắt phiên đang chạy và tự nối lại TikTok): kiểm tra bằng trang đo tĩnh và máy chủ file tĩnh riêng.
- Commit nhỏ theo từng bước, **không có dòng Co-Authored-By**.

## Các cách đã cân nhắc

- *A rồi B* (**đã chọn**): đo và làm nhẹ trước để có "ngân sách" cho hiệu ứng mới.
- *Chỉ A*, *chỉ B*: loại — chỉ A không đạt "bắt mắt"; chỉ B có nguy cơ giật thêm.
- *Thư viện hạt / WebGL (PixiJS, three.js)*: loại — thêm dependency lớn, rủi ro tương thích LIVE Studio; Canvas 2D với ảnh phát sáng vẽ sẵn đủ cho qui mô này.

## Thiết kế đã chốt

- **Đo:** `tools/fx-bench.html` (+ máy chủ tĩnh nhỏ `tools/serve-static.mjs`, chỉ phục vụ `public/`) chạy kịch bản "mưa quà" (nhiều chùm pháo hoa liên tiếp) và in FPS trung bình, FPS 1% thấp nhất, thời gian khung tối đa. Bộ `?fps=1` trong overlay vẽ số FPS góc màn hình.
- **Ảnh phát sáng vẽ sẵn:** mỗi màu trong `PALETTES` vẽ một lần ra canvas phụ; vẽ hạt bằng `drawImage` + `globalCompositeOperation = 'lighter'` thay vì `shadowBlur`.
- **Hạt:** mảng cố định (pool), mỗi hạt lưu vị trí cũ thay mảng vệt; trần hạt mặc định 900, giảm khi chất lượng thấp.
- **Bộ điều khiển chất lượng:** đo thời gian khung bằng `requestAnimationFrame`; 3 mức (cao / vừa / thấp); tụt xuống khi trung bình > ~24ms trong ~2 giây, lên lại khi < ~18ms trong ~10 giây; mức thấp tương đương `fxLite`. Chủ dự án vẫn bật `fxLite` tay được.
- **CSS:** thay `backdrop-filter` của `.card`, `#banner` bằng nền đặc/gradient; chuyển các animation `box-shadow`/`filter` sang lớp `opacity` + `transform`.
- **B:** mỗi hiệu ứng là một hàm nhận tham số và tự dọn DOM; được gọi từ `main.js` / `fx.js` bằng một dòng; có trần số hiệu ứng đồng thời.

## Để người xây dựng quyết (chọn đơn giản, ghi trong commit)

- Ngưỡng cụ thể của bộ điều khiển chất lượng (tinh chỉnh sau khi có số đo).
- Màu, kích thước, thời lượng, giai điệu chuyển động của từng hiệu ứng B.
- Tên file và cấu trúc test.
- Thứ tự làm trong B (khuyến nghị: 1 → 2 → 4 → 3).

## Rủi ro đã biết

- **TikTok LIVE Studio có thể render khác Chrome** (kể cả không tăng tốc GPU). Số đo trên Chrome chỉ là gần đúng; vì vậy cần bộ `?fps=1` để đọc FPS thật trong Studio.
- Bỏ `backdrop-filter` làm thẻ nhìn hơi khác; cần so ảnh chụp trước/sau trên cả 8 theme mặc định có sẵn.
