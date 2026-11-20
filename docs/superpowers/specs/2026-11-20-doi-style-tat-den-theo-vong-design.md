# Đổi style mỗi vòng và hết vòng tắt đèn (thiết kế ngắn)

Ngày: 2026-11-20. Cỡ việc: thay đổi nhỏ (2 mục liên quan). Nguồn: bản phát hành khác ở `D:\live\ThapSang-Portable\ThapSangBanDo-Portable` (2026.11.16.2).

Phạm vi đã chốt với chủ kênh: chỉ làm **#9** và **#10**. **#11** (rồng vàng bằng video) bị hoãn, **#12** (tự tải lại overlay, tự tắt app) không làm.

## Ý định
Đưa hai chức năng nhỏ từ bản D sang bản hiện tại để buổi live đỡ đơn điệu: bản đồ đổi diện mạo theo vòng, vòng mới thắp lại từ đầu.

## Mục tiêu
- #9 Mỗi vòng mới tự chọn ngẫu nhiên một style màn hình khác style đang dùng.
- #10 Hết vòng thì tắt hết đèn sau màn chúc mừng, vòng mới thắp lại từ đầu.

## Không làm / tránh
- Không làm #11 và #12.
- Không đổi hành vi mặc định của buổi live đang chạy: cả hai mặc định **tắt**.
- Không đụng phần đang sửa dở của `game.mjs`, `settings.mjs`, `control.html` (chỉ thêm dòng nhỏ). Không commit các file đó.

## Cách làm: chỉ có một cách hợp lý
Chép đúng cơ chế của bản D, chỉnh cho khớp tầng của bản hiện tại.

## Thiết kế

### #9 Đổi style mỗi vòng
- Cài đặt `themeRotate` (mặc định `false`), có ô tick ở trang "Luật chơi" trong `control.html`.
- `endRound()` (`src/domain/game.mjs`): sau khi tăng `S.roundNo`, gọi `rotateTheme()`. Hàm chọn ngẫu nhiên một style trong `['mac-dinh', ...styles.list()]` khác `settings.theme`, ghi `settings.theme`, `save()`, và broadcast `settings` cho bảng điều khiển. Không còn style nào khác thì không làm gì.
- Danh sách style đưa vào bằng `setThemePool(fn)` do `server.mjs` gắn (domain không import tầng `dist`).
- Overlay đã có hiệu ứng đổi style mượt khi `settings.theme` đổi, không cần sửa.

### #10 Hết vòng tắt đèn
- Cài đặt `roundClearMap` (mặc định `false`) và `keepGifts` (mặc định `true`), có ô tick.
- `endRound()` (chỉ khi vòng có người thắng): nếu bật `roundClearMap`, hẹn 8 giây (`ROUND.clearMs`) rồi `clearMapAfterRound(cut)`.
  - Xóa các tỉnh trong `S.lit` có `at < cut` (tỉnh mới sáng trong lúc chờ thì giữ).
  - Xóa `S.who`, `S.last`, hàng gom tỉnh `batchLit`; xóa `S.gifts` nếu `keepGifts === false`.
  - Ghi log, `broadcast({ t: 'reset' })`, `pushNow()`.
  - Không đụng thanh tim (`S.hearts`), nhiệm vụ, bình chọn, điểm vòng mới, số vòng thắng.
- `resetSession(keepWins)` ("Bản đồ mới"): khi `keepWins`, giữ thêm `S.roundNo` (hiện bị đưa về 1) và giữ `S.gifts` nếu `keepGifts !== false`.
- Hàm hẹn giờ gọi `.unref()`.
- `settings.mjs`: thêm 3 khóa vào `settings` và `RULES` (`themeRotate`, `roundClearMap`, `keepGifts`, đều là `!!v`).

## Để người làm quyết định
Lời văn các ô tick và vị trí chính xác trong trang "Luật chơi".

## Kiểm thử
- `rotateTheme`: không chọn trùng style, tắt thì không đổi, hết style thì không đổi.
- `clearMapAfterRound`: giữ tỉnh mới sáng, theo `keepGifts`, không đụng `S.hearts`.
- `resetSession` giữ `roundNo` và quà.
- Luật cài đặt mới.
- Kiểm tay trên trình duyệt thật: hết vòng thì style đổi, đèn tắt sau 8 giây.

## Rủi ro đã biết
Ba file đang sửa dở của chủ kênh sẽ lẫn dòng của tôi với thay đổi dở của họ; khi commit phải tách theo khối (`git add -p`) hoặc chủ kênh tự chốt phần dở trước.
