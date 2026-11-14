# 8 hiệu ứng bắt mắt — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Thêm 8 hiệu ứng thu hút: (1) ánh sáng lan sang tỉnh kề, (2) không khí lúc vắng, (3) bản đồ đập theo nhạc/giọng MC, (4) tên chữ lớn khi tỉnh sáng lần đầu, (5) combo thắp đèn đẹp hơn, (6) hoa theo miền, (7) bầu trời đổi theo giờ, (8) cảnh mở màn.

**Architecture:** Mỗi hiệu ứng là một module overlay riêng (WAAPI, chỉ `transform`/`opacity`, tự nạp CSS, dọn đúng một lần, ngân sách trần). Cài đặt ở máy chủ, gửi xuống overlay trong `look.fx`; `fx-options.js` giữ cờ bật/tắt. Nối vào `main.js` bằng vài dòng.

## Global Constraints

- File chủ kênh đang sửa dở (KHÔNG commit, KHÔNG stage, chỉ sửa hunk nhỏ bằng Edit hoặc script Node dò kiểu xuống dòng; **cấm `sed -i`**; nhiều file là CRLF): `public/control.html`, `src/domain/game.mjs`, `src/domain/settings.mjs`. Còn lại (kể cả `main.js`, `render.js`, `combo.js`, `audio.js`, `rpc.mjs`, `control.js`) sạch, commit bằng đường dẫn rõ ràng (không `git add -A`). Kiểm tra `git status --short` trước khi commit.
- Chỉ animate `transform`/`opacity` (WAAPI); không `filter`/`backdrop-filter`/`box-shadow` động; không nhấp nháy toàn màn hình nhanh (> 3 lần/giây). Tắt khi `isLite()`; phần nặng bỏ khi `qualityLevel() >= 2`; mọi tên người xem đặt bằng `textContent`; mọi phần tử tự dọn đúng một lần; trần số phần tử đồng thời cho từng hiệu ứng.
- **Không nối vào WebAudio** (`createMediaElementSource`/`AudioContext` analyser) cho hiệu ứng "đập theo nhạc": nếu ngữ cảnh âm thanh bị chặn thì tiếng của phần tử `<audio>` sẽ câm hẳn. Chỉ đọc trạng thái (đang có nhạc / MC đang nói).
- Khi không có hiệu ứng nào đang chạy thì không được có `requestAnimationFrame` chạy nền; timer nền chỉ được là `setInterval` ≥ 500 ms và chỉ tồn tại khi hiệu ứng đó đang bật.
- Không chạy `node server.mjs`; không ghi vào `data/`; test: `node --test` (hiện 129 đạt, sẽ tăng sau kế hoạch tim/chia sẻ/bình chọn). Không `Co-Authored-By`.
- Mỗi hiệu ứng có ô bật/tắt trong bảng điều khiển (không tham số URL).

## Cài đặt (đều trong `settings.mjs` + `RULES`, gửi xuống overlay qua `look.fx = { ambient, wave, name, combo, sky, intro, beat, region }`)

| Khóa | Mặc định |
|---|---|
| `fxAmbient` | true |
| `fxWave` | true |
| `fxName` | true |
| `fxCombo` | true |
| `fxSky` | true |
| `fxIntro` | true (tự chiếu khi mở overlay lúc buổi live còn trống, `litCount === 0`; và nút "▶ Chiếu cảnh mở màn" chiếu bất cứ lúc nào) |
| `fxBeat` | false (nặng hơn, chủ kênh tự bật sau khi đo FPS) |
| `fxRegion` | false (nặng hơn, chủ kênh tự bật sau khi đo FPS) |

## Review Focus

1. Quà/comment dồn dập (34 tỉnh sáng trong vài giây): không vượt trần phần tử, không rò DOM, không lỗi.
2. Mọi hiệu ứng tắt sạch khi bỏ tick hoặc khi `isLite()` đổi giữa chừng (không để vòng lặp hay phần tử mồ côi).
3. Tên chứa HTML hiện như chữ thường; tỉnh không tồn tại / bản đồ chưa dựng → trả về êm.
4. Cảnh mở màn không chiếu lại mỗi lần tải lại nguồn khi buổi live đã có tỉnh sáng; nút thủ công luôn chạy.
5. Hiệu ứng "đập theo nhạc" không làm đổi đường đi âm thanh (không tạo `AudioContext`/`MediaElementSource`).

---

### Task 1: Cài đặt, máy chủ, bảng điều khiển

**Files:** Modify `src/domain/settings.mjs` (8 khóa + RULES), `src/domain/game.mjs` (`look: {..., fx: {...}}`), `src/protocol/rpc.mjs` (RPC `fx.intro` → `broadcast({ t: 'intro' })`, trả `{ ok: true }`), `public/js/control.js` (nút `#btnIntro` gọi `call('fx.intro')`), `public/control.html` (mục "🎆 Hiệu ứng nâng cao" với 8 ô tick `data-k` và nút "▶ Chiếu cảnh mở màn" `id="btnIntro"`). `settings.mjs`, `game.mjs`, `control.html` KHÔNG commit; `rpc.mjs` và `control.js` commit được.

- [ ] Làm theo bảng cài đặt; `look.fx` luôn gửi đủ 8 cờ bool. Test thuần (nếu trích hàm `fxFlags(settings)` ra file mới `src/domain/fx-flags.mjs`) cho giá trị mặc định và ép bool. Commit `src/protocol/rpc.mjs public/js/control.js src/domain/fx-flags.mjs tests/fx-flags.test.mjs`.

### Task 2: Nhóm 1 — không khí, lan sáng, tên chữ lớn, combo, tùy chọn

**Files:** Create `public/js/overlay/fx-options.js` (`setFxOptions(fx)`, `fxOn(name): boolean`, mặc định tất cả `false` cho tới khi nhận `look.fx`), `fx-ambient.js` + `public/css/fx-ambient.css`, `fx-wave.js` + `fx-wave.css`, `fx-names.js` + `fx-names.css`, `fx-combo.css` (nạp bởi `combo.js`), sửa `combo.js` (chỉ thêm nạp CSS + cờ `fxOn('combo')`), `main.js`.

- [ ] (2) `startAmbient()/stopAmbient()` trong `fx-ambient.js` (gọi theo `fxOn('ambient')` mỗi lần nhận `state`; idempotent): tối đa 10 đom đóm vàng bay lơ lửng chậm (WAAPI vô hạn, chỉ `transform`+`opacity`, vị trí ngẫu nhiên trong vùng bản đồ), mỗi 25–45 giây một đèn lồng thả nhẹ từ dưới lên, mỗi 40–90 giây một sao băng mờ; `setInterval` ≥ 1000 ms duy nhất; ẩn khi `document.hidden`; tắt hoàn toàn khi `isLite()`/`qualityLevel() >= 1` giảm còn 4 đom đóm không đèn lồng.
- [ ] (1) `lightWave(prov)`: lấy tối đa 8 tỉnh có tâm trong bán kính 170 px (tọa độ sân khấu `P[t].cx/cy`) quanh tỉnh vừa sáng, sắp theo khoảng cách; mỗi tỉnh nháy sáng một lần bằng WAAPI `opacity` trên phần tử đường (`P[t].path`) với `delay = dist * 2.2 ms`, `duration = 700 ms`; chỉ chạy cho tỉnh đang SÁNG (class `on`); trần 1 đợt sóng cùng lúc (đợt mới trong lúc đang chạy bị bỏ).
- [ ] (4) `showNameBurst({ name, prov })`: tên (cắt 22 ký tự) hiện từng chữ (mỗi chữ một `<span>`, `transform`+`opacity`, trễ 40 ms/chữ) phía trên tỉnh, giữ ~1.4 s rồi mỗi chữ bay lên mờ dần như tàn lửa; chỉ cho lần sáng đầu (`m.fresh`); trần 1 cảnh cùng lúc; vị trí kẹp trong khung 24..1056 để không tràn.
- [ ] (5) `fx-combo.css` đè kiểu `.combo-badge`: số `.combo-num b` lớn, màu theo cấp (x3 vàng, x10 cam `tier-2`, x25 đỏ-tím `tier-3`), vòng sáng nhịp thở dùng `transform`/`opacity`; `combo.js` chỉ nạp CSS này khi `fxOn('combo')` (tắt thì giữ kiểu cũ).
- [ ] `main.js`: import; trong handler `state` thêm `setFxOptions(s.look?.fx)` rồi `fxOn('ambient') ? startAmbient() : stopAmbient()`; trong nhánh `if (m.fresh)` của handler `light`: `if (fxOn('wave')) lightWave(m.prov); if (fxOn('name')) showNameBurst({ name: m.name, prov: m.prov });`.
- [ ] Test thuần nếu có logic (`fx-options.js` flag handling chạy được trong Node không DOM); `node --check`; `node --test` PASS; commit các file sạch.

### Task 3: Nhóm 2 — bầu trời, mở màn, đập theo nhạc, hoa theo miền

**Files:** Create `fx-sky.js` + `fx-sky.css`, `fx-intro.js` + `fx-intro.css`, `fx-beat.js` + `fx-beat.css`, `fx-region.js` + `fx-region.css`; sửa `audio.js` (chỉ thêm `export function audioState(): { talking: boolean, music: boolean }` đọc trạng thái hiện có: `talking` và `!bgm.paused`; KHÔNG tạo AudioContext mới, KHÔNG đổi luồng âm thanh), `main.js`.

- [ ] (7) `setSky(on)`: lớp `#skyTint` (một `<div>` thêm vào `#stage` ngay trước `#stars`, `pointer-events: none`, gradient đứng) đổi màu theo giờ thật (giờ máy): 5–7 bình minh (hồng cam nhạt), 7–17 xanh đêm dịu (giữ độ tương phản chữ), 17–19 hoàng hôn (cam tím), 19–5 đêm sao; chuyển màu bằng `opacity` chéo hai lớp (A/B) mỗi khi đổi khung giờ; một `setInterval` 60 s duy nhất (chỉ khi bật); tắt thì gỡ lớp.
- [ ] (8) `playIntro()`: 5 giây: tên "THẮP SÁNG BẢN ĐỒ VIỆT NAM" hiện chữ sáng dần, các tỉnh hiện lần lượt Bắc → Trung → Nam (WAAPI `opacity` trên `P[t].path`, thứ tự theo `cy`, trễ nhỏ) rồi trở về trạng thái thật (KHÔNG đổi class `on` hay dữ liệu; chỉ animate rồi trả `opacity` về như cũ); tự chiếu một lần khi nhận `state` đầu tiên của trang nếu `fxOn('intro') && s.litCount === 0`; handler `intro` (nút thủ công) luôn chiếu (nếu `isLite()` thì chỉ hiện tên 2 giây); không chiếu chồng.
- [ ] (3) `startBeat()/stopBeat()`: vòng sáng viền quanh `#mapBox` (một phần tử, WAAPI vô hạn `transform: scale` 1 → 1.012 + `opacity`), nhịp 100 BPM khi `audioState().music`, mạnh hơn (scale 1.02, nhịp theo câu) khi `audioState().talking`, dừng hẳn khi cả hai false; kiểm tra `audioState()` bằng `setInterval` 500 ms chỉ khi bật; tắt khi `isLite()` hoặc `qualityLevel() >= 1`.
- [ ] (6) `regionBloom(prov)`: theo miền của tỉnh (nếu `public/data/tinh.js` có trường miền thì dùng, nếu không dùng `cy`: < 700 Bắc, < 1250 Trung, còn lại Nam): Bắc: 10 cánh hoa đào hồng rơi nhẹ từ phía trên tỉnh; Trung: 3 vệt gió cong + vài hạt cát vàng bay ngang; Nam: hoa sen 3 lớp cánh nở (`transform: scale` + `opacity`) tại tỉnh; chỉ cho lần sáng đầu, trần 24 phần tử, 1 cảnh cùng lúc, tắt khi `qualityLevel() >= 1` hoặc `isLite()`.
- [ ] `main.js`: import; trong `state`: `setSky(fxOn('sky'))`, `fxOn('beat') ? startBeat() : stopBeat()`, tự chiếu mở màn như trên; handler `intro: playIntro`; trong nhánh `m.fresh` của `light`: `if (fxOn('region')) regionBloom(m.prov)`.
- [ ] `node --check`, `node --test` PASS, commit các file sạch (`audio.js`, `main.js` và file mới).

### Task 4: Kiểm tra (controller)

Trình duyệt với trạng thái giả: chụp ảnh từng hiệu ứng, bật/tắt từng cờ, thử 34 lần `lightWave` liên tiếp, kiểm tra không phần tử mồ côi, và kiểm tra `audio.js` không tạo `AudioContext`/`MediaElementSource` mới (`grep`). Một reviewer mạnh đọc toàn bộ nhánh trước khi giao.
