# Hiệu ứng điện ảnh B1 + B2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm hai hiệu ứng bắt mắt nhưng nhẹ: (B1) đèn lồng + tàn lửa bay lên khi một tỉnh sáng lần đầu; (B2) cảnh điện ảnh khi có quà lớn (dải đen trên/dưới, tia sáng, tên quà chữ lớn).

**Architecture:** Logic thuần (phân bậc quà, ngân sách hiệu ứng đồng thời) viết riêng và test bằng `node --test`. Phần vẽ là một module trình duyệt mới dùng WAAPI chỉ với `transform` + `opacity` (không `filter`, không `box-shadow` động), tự nạp CSS riêng, tự dọn DOM, tôn trọng `isLite()` và mức chất lượng `qualityLevel()`. Nối vào overlay bằng vài dòng trong `main.js`.

**Tech Stack:** JavaScript ESM thuần, CSS, WAAPI. Không thêm thư viện.

**Spec:** `docs/superpowers/specs/2026-11-14-hieu-ung-muot-va-dien-anh-design.md` (phần B, mục 1 và 2); phần A đã xong (`docs/perf/fx-A-results.md`).

## Global Constraints

- Không sửa các file chủ kênh đang sửa dở (đang có thay đổi chưa commit): `public/control.html`, `public/css/fx-perf.css`, `public/css/overlay.css`, `public/js/overlay/fx.js`, `public/js/overlay/theme.js`, `public/overlay.html`, `src/domain/game.mjs`, `src/domain/settings.mjs`. Nối hiệu ứng chỉ qua `public/js/overlay/main.js` (chưa bị sửa) và file mới.
- Không thêm dependency; không đụng `data/`, `auto-pacing`, bản quyền, gói giao diện; không chạy `node server.mjs`.
- Chỉ animate `transform` và `opacity`. Không `filter`, không `box-shadow` động, không nhấp nháy toàn màn hình nhanh (> 3 lần/giây); tia sáng xoay chậm (≥ 8 giây/vòng), dải đen trượt vào/ra êm.
- Không hiện khi `isLite()` là true; bỏ B1 nặng khi `qualityLevel() >= 2` và bỏ cả B1, B2 khi `qualityLevel() >= 2` cho phần tia sáng (chỉ giữ chữ + dải đen).
- Phải hiện rõ ở camera toàn cảnh cố định (chủ kênh để `camZoom` tắt): đặt theo tọa độ sân khấu 1080×1920, không dựa vào zoom.
- Trần số hiệu ứng đồng thời: B1 tối đa 24 phần tử đèn lồng/tàn lửa sống cùng lúc; B2 tối đa 1 cảnh cùng lúc (quà tới khi đang chiếu thì bỏ qua cảnh mới, không xếp hàng).
- Không có `Co-Authored-By` trong commit. Lệnh test: `node --test` (không dùng `node --test tests/`). Commit chỉ `git add` đúng file của task (không `git add -A`, không `git add` file nằm trong danh sách "đang sửa dở").

## Review Focus

1. Quà dồn dập (10 quà ≥ 100 xu trong 1 giây): không tạo quá 1 cảnh B2, DOM không phình, không lỗi. → test ở Task 1 + kiểm tra Task 2.
2. Tỉnh sáng liên tiếp (34 tỉnh trong vài giây, "cả nước rực sáng"): B1 không vượt trần 24 phần tử. → test ở Task 1.
3. Gọi hiệu ứng với tỉnh không tồn tại / chưa dựng bản đồ: không ném lỗi. → Task 2.
4. Tab bị ẩn rồi hiện lại: các phần tử WAAPI vẫn bị dọn (không mồ côi trong DOM). → Task 2.
5. Tên người tặng chứa ký tự HTML (`<img onerror=...>`): hiển thị an toàn như chữ thường (dùng `textContent`). → Task 2.

## File Structure

| File | Việc | Loại |
|---|---|---|
| `public/js/overlay/fx-cinema-logic.js` | Phân bậc quà + ngân sách hiệu ứng (thuần) | Tạo |
| `tests/fx-cinema-logic.test.mjs` | Test cho module trên | Tạo |
| `public/js/overlay/fx-cinema.js` | `lanternRise`, `bigGiftCinema` (trình duyệt) | Tạo |
| `public/css/fx-cinema.css` | Kiểu dáng đèn lồng, dải đen, tia sáng, chữ | Tạo |
| `public/js/overlay/main.js` | Nối 2 lời gọi vào handler `light` và `gift` | Sửa |

---

### Task 1: Logic thuần (bậc quà + ngân sách)

**Files:**
- Create: `public/js/overlay/fx-cinema-logic.js`
- Test: `tests/fx-cinema-logic.test.mjs`

**Interfaces:**
- Produces: `export function giftTier(coins: number): 0|1|2|3` (< 30 → 0; 30–99 → 1; 100–999 → 2; ≥ 1000 → 3; không phải số hữu hạn hoặc ≤ 0 → 0); `export function createBudget(max: number): { tryAcquire(n?: number): boolean; release(n?: number): void; readonly active: number }`; `export const LANTERN_MAX = 24`; `export function lanternCount(quality: number, fresh: boolean): number` (quality 0 và fresh → 6; quality 1 và fresh → 3; quality ≥ 2 hoặc không fresh → 0).

- [ ] **Step 1: Viết test thất bại** trong `tests/fx-cinema-logic.test.mjs` (`node:test` + `node:assert/strict`; xem `tests/fx-pool.test.mjs` để theo kiểu): `giftTier` các biên 0, 29, 30, 99, 100, 999, 1000, NaN, -5, undefined, '100' (chuỗi → 0); `createBudget(2)`: hai lần `tryAcquire()` đúng, lần ba sai, `active === 2`; `release()` rồi `tryAcquire()` lại đúng; `release()` quá số đang giữ không làm `active` âm; `tryAcquire(3)` trên budget 2 → sai và `active` không đổi; 5000 lần `tryAcquire()` trên `createBudget(24)` → `active === 24`; `lanternCount(0, true) === 6`, `(1, true) === 3`, `(2, true) === 0`, `(0, false) === 0`.
- [ ] **Step 2: Chạy** `node --test tests/fx-cinema-logic.test.mjs` → FAIL (chưa có module).
- [ ] **Step 3: Cài đặt** các hàm trên trong `fx-cinema-logic.js` (module thuần, không import DOM/Node).
- [ ] **Step 4: Chạy** `node --test` toàn bộ → PASS (31 test cũ + test mới).
- [ ] **Step 5: Commit** `git add public/js/overlay/fx-cinema-logic.js tests/fx-cinema-logic.test.mjs && git commit -m "Thêm logic thuần cho hiệu ứng điện ảnh (có test)"`

---

### Task 2: Hiệu ứng trình duyệt + nối vào `main.js`

**Files:**
- Create: `public/js/overlay/fx-cinema.js`, `public/css/fx-cinema.css`
- Modify: `public/js/overlay/main.js` (hai dòng nối + một dòng import)

**Interfaces:**
- Consumes: `giftTier`, `createBudget`, `LANTERN_MAX`, `lanternCount` (Task 1); `P` từ `./map.js` (`P[ten] = { cx, cy, ... }`, tọa độ trong hệ 1080×1920 của `#marks`); `$`, `esc` không cần; `isLite` từ `./theme.js`; `qualityLevel` từ `./fx-perf.js`.
- Produces: `export function lanternRise(prov: string): void`; `export function bigGiftCinema(ev: { prov?: string, name: string, gift: string, coins: number }): void`.

- [ ] **Step 1: Cài `fx-cinema.js`** theo mô tả: khi nạp module tự thêm `<link rel="stylesheet">` tới `fx-cinema.css` (dựng đường dẫn bằng `new URL('../../css/fx-cinema.css', import.meta.url)`), chỉ một lần. 
  - `lanternRise(prov)`: thoát sớm nếu `isLite()`, nếu `P[prov]` không có, hoặc `lanternCount(qualityLevel(), true) === 0`. Dựng `n = lanternCount(...)` phần tử `<div class="cn-lantern">` (đèn lồng) cùng `n * 2` tàn lửa `<i class="cn-ember">` trong `#marks` tại `P[prov].cx/cy`, mỗi phần tử xin `budget.tryAcquire()` (trần `LANTERN_MAX`), bay lên 160–280 px, lắc nhẹ ±14 px, mờ dần; dùng `el.animate([...], {duration: 2400–3800ms, easing: 'ease-out'})` chỉ với `transform` + `opacity`; khi `finished` (hoặc sau `duration + 400ms` bằng `setTimeout` dự phòng) thì `el.remove()` và `budget.release()` đúng một lần.
  - `bigGiftCinema({prov, name, gift, coins})`: tier = `giftTier(coins)`; tier < 2 → thoát; nếu cảnh đang chiếu (`budget.tryAcquire()` của một budget riêng `createBudget(1)` thất bại) → thoát; nếu `isLite()` → thoát. Dựng trong `#stage`: hai dải đen `.cn-bar.top` / `.cn-bar.bot` (cao 120 px, trượt vào bằng `transform: translateY`), chữ giữa `.cn-title` (dòng 1: tên người tặng; dòng 2: tên quà + số xu) đặt bằng `textContent` (không `innerHTML`), phóng vào nhẹ (scale .9 → 1) rồi mờ ra; nếu `qualityLevel() < 2` thêm `.cn-rays` (conic-gradient trong suốt, xoay chậm ≥ 8s/vòng bằng `transform: rotate`, `opacity` ≤ .35); tier 3 thời lượng 4800ms, tier 2 thời lượng 3200ms. Mọi phần tử tự xóa khi kết thúc (WAAPI `finished` + `setTimeout` dự phòng) và `release()` budget đúng một lần.
  - `fx-cinema.css`: kiểu cho `.cn-lantern` (thân đỏ cam, viền vàng, dây treo, kích thước ~22×28 px), `.cn-ember` (chấm 4–6 px vàng cam), `.cn-bar` (nền #000, `position:absolute; left:0; right:0; z-index: 40; pointer-events:none`), `.cn-title` (căn giữa theo chiều ngang, `top: 44%`, chữ lớn 64px đậm có `text-shadow` TĨNH, `z-index: 41`), `.cn-rays` (vòng tròn 1400×1400 tâm màn hình, `pointer-events:none`, `z-index: 39`, `will-change: transform`). Không `filter`, không `backdrop-filter`.
- [ ] **Step 2: Sửa `main.js`**: thêm `import { lanternRise, bigGiftCinema } from './fx-cinema.js';`; trong handler `light`, nhánh `if (m.fresh) {` thêm `lanternRise(m.prov);`; trong handler `gift`, ngay sau khối "// 4. Banner hoàng gia" (hoặc cuối handler) thêm `if (m.coins >= 100) bigGiftCinema({ prov: m.prov, name: m.name, gift: m.gift, coins: m.coins });`. Không đổi gì khác trong `main.js`.
- [ ] **Step 3: Kiểm tra cú pháp:** `node --check` (sao chép sang `.mjs` tạm) cho `fx-cinema.js` và `main.js`; `node --test` toàn bộ PASS.
- [ ] **Step 4: Commit** `git add public/js/overlay/fx-cinema.js public/css/fx-cinema.css public/js/overlay/main.js && git commit -m "Hiệu ứng điện ảnh: đèn lồng khi tỉnh sáng lần đầu, cảnh quà lớn"`
- [ ] **Step 5 (controller, trình duyệt):** trên `overlay.html` tĩnh với trạng thái giả: gọi `lanternRise` cho 34 tỉnh liên tiếp (DOM ≤ 24 phần tử đèn/tàn lửa), `bigGiftCinema` 10 lần trong 1 giây (chỉ 1 cảnh), tên chứa `<img src=x onerror=alert(1)>` hiện như chữ thường, ảnh chụp ở `camZoom` tắt, đo FPS bằng `?fps=1` lúc đang chiếu, kiểm tra không còn phần tử mồ côi sau 6 giây.

## Self-Review

- **Spec coverage (B1, B2):** đèn lồng + tàn lửa → Task 2; quà lớn điện ảnh (dải đen, tia sáng, chữ lớn) → Task 2; trần đồng thời và nhẹ → Task 1; B3 (rồng canvas) và B4 (leo thang) để sau.
- **Types:** `giftTier`, `createBudget`, `LANTERN_MAX`, `lanternCount` định nghĩa ở Task 1 và dùng đúng tên ở Task 2.
