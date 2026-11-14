# Thiết kế: Mục tiêu chung (tim + xu) và Giữ chân / Chia sẻ

Ngày: 2026-11-14 · Trạng thái: **TẠM HOÃN** — chủ dự án ưu tiên hiệu ứng bắt mắt và mượt; tổng kết cuối buổi để sau (không biết lúc nào dừng live). Giữ lại làm tham khảo.

## Ý định và lý do

Chủ dự án là streamer, dùng overlay "Thắp Sáng Bản Đồ Việt Nam" để **kéo tương tác và nhận quà** trên TikTok LIVE của chính mình (qui mô 100–500 người xem cùng lúc). Mong muốn: phòng live "xịn" hơn để người xem thả tim, follow, tặng quà nhiều hơn và quay lại buổi sau.

Quan sát từ code hiện tại:
- Thả tim chỉ cộng điểm khi `likePts > 0` (mặc định 0) và không có mục tiêu nào để cả phòng cùng hướng tới.
- Quà chỉ cộng điểm cho **quê** của người tặng; chưa có mục tiêu chung kiểu "cả phòng góp đủ X xu thì mở khóa Y".
- Người xem không có lý do quay lại: `fans.json` chỉ nhớ quê (`home`), không nhớ chuỗi ngày hay thành tích.
- Không có màn hình tổng kết cuối buổi để người xem chụp / quay lại chia sẻ.

## Mục tiêu

1. **Mục tiêu chung**: hai thanh tiến độ cả phòng cùng góp — *tim* và *xu* — mỗi thanh có 3 mốc. Đạt mốc → hiệu ứng, banner, MC đọc.
2. **Chuỗi ngày quay lại** cho người xem quen + **bảng vàng top fan tuần**.
3. **Màn hình tổng kết cuối buổi** 9:16, bật bằng nút bấm thủ công.

## Không phải mục tiêu

- Không sửa, không gỡ `src/ingest/auto-pacing.mjs` (chủ dự án muốn giữ nguyên).
- Không đụng vào bản quyền / kích hoạt key (`src/dist/ban-quyen.mjs`, `license.mjs`).
- Không đo / lưu lịch sử nhiều buổi (đó là hạng mục "đo kết quả" riêng, chưa chọn).
- Không tạo giao diện (theme) mới; không đụng thư mục `data/` trong git.
- Không thêm thư viện npm.

## Phản mục tiêu (coi như thất bại dù chạy được)

- **Tim / quà / follow từ người xem ảo (uid bắt đầu bằng `auto_` hoặc `demo`, hàm `isBotUid`) bị cộng vào mục tiêu chung, chuỗi ngày, bảng vàng hoặc tổng kết.** Mọi số liệu mới chỉ tính người thật.
- Overlay che mất bản đồ hoặc các thẻ đang có; chậm / giật trên máy yếu (có chế độ `fxLite` phải được tôn trọng).
- Làm hỏng dữ liệu cũ: `data/state.json` và `data/fans.json` của bản đã chạy phải đọc được bình thường.

## Ràng buộc

- Node thuần ESM (`.mjs`), kiến trúc 5 tầng hiện có; mô-đun mới đặt trong `src/domain/`, hiển thị trong `public/js/overlay/`.
- Mọi cập nhật trạng thái đi qua `S` (`src/domain/store.mjs`), tự lưu đĩa debounce; overlay nhận qua `broadcast` + `snapshot()`.
- Dữ liệu cũ thiếu trường mới thì dùng giá trị mặc định (không lỗi).
- Giao diện đặt vào file mới (`goal.js`, `goal.css`, ...) càng nhiều càng tốt; chỗ phải sửa trong file có sẵn thì sửa tối thiểu.
- Không có bộ test hiện có: tính năng mới phải kèm test chạy được bằng `node --test`, không cần mạng.
- Commit nhỏ theo từng phần, **không có dòng Co-Authored-By**.

## Các cách đã cân nhắc

**Phần 1 — Mục tiêu chung**
- *A. Mô-đun `goal.mjs` ở tầng domain theo khuôn `chest.mjs`/`duel.mjs`* (**đã chọn**): đếm ở máy chủ nơi thấy được mọi tim và quà, phát sự kiện, overlay chỉ vẽ.
- *B. Overlay tự đếm*: loại — overlay không nhận từng lượt tim nên số sai.
- *C. Tiến trình phụ nối TikTok lần hai*: loại — gấp đôi kết nối, dễ vướng giới hạn của EulerStream, phức tạp hơn nhiều.

**Phần 2 — Giữ chân / chia sẻ**
- Chuỗi ngày + bảng vàng: lưu thêm trong `fans.json` (kho người xem quen có sẵn). Tổng kết: tính từ `S` + bộ đếm mới `S.stats`.
- Kích hoạt tổng kết: *nút bấm thủ công* (**chủ dự án chọn**); tự động theo thời gian bị loại vì dễ hiện nhầm lúc live vắng.

## Thiết kế đã chốt

### Phần 1 — Mục tiêu chung

- Cài đặt mới trong `settings.mjs` (kèm bộ lọc `RULES` như `giftTiers`): `goalOn` (bật/tắt, mặc định bật), `goalLikes` = `"5000,15000,40000"`, `goalCoins` = `"500,2000,6000"` (mức 100–500 người xem, **chủ dự án chỉnh được trên bảng điều khiển**).
- Trạng thái trong `S`: `S.stats = { likes, comments, follows, coins }` và `S.goal = { likesDone: n, coinsDone: n }` (số mốc đã đạt). Reset theo buổi qua `freshSession()`.
- Cộng dồn từ `onLike` (cộng `min(n, 100)`), `onGift` (cộng `coins`) — **bỏ qua nếu `isBotUid(uid)`**. `onChat` và `onFollow` chỉ tăng `S.stats` (không tính mục tiêu).
- Đạt mốc: phát `{ t: 'goal', kind: 'tim'|'xu', level: 1..3, value }`; overlay chiếu banner + pháo hoa (`nationWide`/`giftFx` có sẵn); MC đọc qua `say([...], { tag: 'win' })` có tên người góp đúng lúc đạt mốc.
- Mốc 3: tim → `startChest()` (nếu chưa có rương); xu → `startDuel()` (nếu không bắt đầu được thì `startChest()` thay thế).
- Snapshot gửi overlay thêm `goal: { likes: {cur, next, prev, level}, coins: {...} }`; overlay vẽ **thẻ thanh tiến độ** (hai thanh mảnh, hiện số hiện tại / mốc kế).
- Bảng điều khiển: ô chỉnh `goalLikes`, `goalCoins`, công tắc bật/tắt; nút "đặt lại thanh mục tiêu".

### Phần 2 — Chuỗi ngày, bảng vàng, tổng kết

- `fans[uid]` thêm: `lastDay` (YYYY-MM-DD theo giờ máy), `streak`, `bestStreak`, `weekKey` (ví dụ `2026-W46`, tuần bắt đầu thứ Hai), `weekCoins`, `weekDays`.
- Cập nhật **lần đầu trong ngày** khi người thật comment / thả tim / vào phòng. Cách ngày liền kề thì `streak+1`, quá 1 ngày thì về 1.
- Streak ≥ 2 → MC gọi "ngày thứ N liên tiếp" (chỉ khi MC rảnh, không xếp hàng quá 2 câu).
- `weekCoins` cộng khi người thật tặng quà; đổi tuần thì về 0.
- **Bảng vàng top fan tuần**: top 5 theo `weekCoins` (đồng hạng thì theo `weekDays`, rồi `streak`); một thẻ mới nằm trong vòng xoay thẻ của overlay, chỉ hiện khi có ít nhất 1 người.
- **Tổng kết**: `rpc` mới `session.recap` (hiện) / `session.recap.close` (đóng); nút "Kết thúc buổi live" trên bảng điều khiển. Overlay hiện toàn màn hình 9:16 trong ~25 giây rồi tự đóng; gồm: thời lượng buổi, tổng tim / comment / follow / xu, số tỉnh sáng, top 3 người tặng (`S.donors`), top 3 quê (`S.pts`), Chủ tỉnh nổi bật. MC đọc một câu cảm ơn.

## Những điểm do người xây dựng quyết (xin chọn đơn giản, ghi lại trong commit)

- Vị trí và kích thước thẻ mục tiêu / thẻ bảng vàng trên overlay (xem `overlay.css`, xem thử bằng trình duyệt thật ở khung 1080×1920 và với `fxLite`).
- Kiểu hiệu ứng pháo hoa khi đạt mốc (dùng lại hàm có sẵn).
- Câu chữ MC (giữ giọng điệu hiện có).
- Cách đặt tên file test và dữ liệu giả để test.

## Rủi ro đã biết

- Tim TikTok có thể trả số lớn trong một sự kiện; đã chặn trên 100 mỗi sự kiện để thanh không nhảy bất thường.
- `data/state.json` cũ không có `S.stats` / `S.goal`: dựa vào việc `loadStore()` trộn `freshSession()` với bản lưu để có giá trị mặc định (builder cần kiểm tra bằng test).
