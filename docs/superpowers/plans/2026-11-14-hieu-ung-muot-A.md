# Hiệu ứng mượt (Phần A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Làm hiệu ứng pháo hoa/hạt và lớp CSS của overlay chạy mượt hơn, có số đo trước/sau, và tự giảm chất lượng khi máy yếu.

**Architecture:** Logic thuần (bộ điều khiển chất lượng, kho hạt có trần) viết thành module riêng, test bằng `node --test`. `particles.js` giữ nguyên các hàm công khai nhưng bên trong dùng kho hạt + ảnh phát sáng vẽ sẵn thay cho `shadowBlur`. Phần CSS đặt trong file mới `fx-perf.css`, chỉ giữ thay đổi nào đo được là có lợi.

**Tech Stack:** JavaScript ESM thuần (Canvas 2D, CSS), Node 23 (`node --test`), Chrome để đo. Không thêm thư viện.

**Spec:** `docs/superpowers/specs/2026-11-14-hieu-ung-muot-va-dien-anh-design.md` (phần A). Phần B (hiệu ứng điện ảnh) sẽ có kế hoạch riêng sau khi có số đo của A.

## Global Constraints

- Giữ nguyên tên và tham số các hàm công khai của `public/js/overlay/particles.js`: `initParticles(el)`, `launchFirework(x, y, paletteName='gold', count=65, power=15)`, `launchFireworkCluster(x, y, count=3, palette='gold')`, `launchMassiveFireworks()`, `screenShake(level='sm')`, `dragonSparkles(x, y, n=8)`. Nơi gọi: `main.js`, `fx.js`, `3mien.js` và các gói giao diện tải từ máy chủ.
- Không thêm dependency; không sửa `auto-pacing`, bản quyền, `data/`, gói giao diện.
- Tôn trọng chế độ nhẹ hiện có: `body.lite` (đặt bởi `theme.js`) luôn dùng trần hạt thấp nhất.
- Khi không có hạt thì không có `requestAnimationFrame` chạy nền (hiện tại đã đúng, phải giữ). Bộ FPS `?fps=1` chỉ chạy khi có tham số đó.
- **Không chạy `node server.mjs`** (sẽ tắt phiên đang chạy và tự nối lại TikTok). Dùng `tools/serve-static.mjs`.
- Commit nhỏ, mỗi task một commit, **không có dòng Co-Authored-By**. Lệnh test: `node --test tests/`.
- Không nhấp nháy toàn màn hình nhanh (>3 lần/giây).

## Review Focus

1. Tab bị ẩn / OBS tạm dừng rồi chạy lại (một khung hình dài vài giây) **không** bị coi là "máy yếu". → test ở Task 2.
2. Quà dồn dập yêu cầu hàng nghìn hạt: không vượt trần, không lỗi, hạt đang bay không bị cắt đột ngột khi trần giảm. → test ở Task 3.
3. Gọi hiệu ứng khi `initParticles` chưa chạy hoặc canvas là `null`: không ném lỗi. → kiểm tra ở Task 4.
4. Canvas bị co giãn theo khung (stage scale): tọa độ vẫn đúng đơn vị 1080×1920, hạt phát sáng không lệch. → kiểm tra bằng ảnh chụp ở Task 4.
5. Không có `?fps=1`: không có rAF chạy nền khi rảnh; có `?fps=1`: số FPS hiện được ở góc. → kiểm tra ở Task 5.

## File Structure

| File | Việc | Loại |
|---|---|---|
| `tools/serve-static.mjs` | Máy chủ file tĩnh cục bộ cho `public/` và `tools/` | Tạo |
| `tools/fx-bench.html` | Trang đo FPS pháo hoa | Tạo |
| `tests/serve-static.test.mjs` | Test chống truy cập ngoài thư mục | Tạo |
| `public/js/overlay/fx-quality.js` | Bộ điều khiển chất lượng (thuần) | Tạo |
| `public/js/overlay/fx-pool.js` | Kho hạt có trần (thuần) | Tạo |
| `tests/fx-quality.test.mjs`, `tests/fx-pool.test.mjs` | Test cho hai module trên | Tạo |
| `public/js/overlay/fx-glow.js` | Ảnh phát sáng vẽ sẵn (trình duyệt) | Tạo |
| `public/js/overlay/fx-perf.js` | Nối bộ điều khiển với trình duyệt + bộ FPS `?fps=1` | Tạo |
| `public/js/overlay/particles.js` | Viết lại bên trong, giữ API | Sửa |
| `public/css/fx-perf.css` | Giảm lớp CSS nặng theo mức chất lượng + bỏ blur nền luôn bật | Tạo |
| `public/overlay.html` | Thêm 1 dòng `<link>` | Sửa |
| `docs/perf/fx-A-results.md` | Bảng số đo trước/sau | Tạo |

---

### Task 1: Công cụ đo và số đo gốc (trước khi đổi gì)

**Files:**
- Create: `tools/serve-static.mjs`, `tools/fx-bench.html`, `tests/serve-static.test.mjs`, `docs/perf/fx-A-results.md`

**Interfaces:**
- Produces: `resolveSafe(root: string, urlPath: string): string | null` (export từ `tools/serve-static.mjs`); trang `http://127.0.0.1:5173/tools/fx-bench.html` đặt `window.__bench = { avgFps, lowFps1pct, maxFrameMs, frames }` khi xong; `docs/perf/fx-A-results.md` có hàng "Gốc".

- [ ] **Step 1: Viết test thất bại** `tests/serve-static.test.mjs`: `resolveSafe(root, '/js/a.js')` trả đường dẫn nằm trong `root`; `resolveSafe(root, '/../package.json')`, `'/%2e%2e/package.json'` và đường dẫn chứa ký tự NUL trả `null`; `'/'` trả `null` (không liệt kê thư mục).
- [ ] **Step 2: Chạy** `node --test tests/serve-static.test.mjs` → FAIL (chưa có file).
- [ ] **Step 3: Cài `tools/serve-static.mjs`**: `resolveSafe` dùng `path.resolve` + kiểm tra tiền tố; máy chủ `node:http` lắng nghe **chỉ `127.0.0.1`** cổng 5173 (đối số `--port`), phục vụ gốc là thư mục dự án nhưng chỉ cho phép đường dẫn bắt đầu bằng `/public/`, `/tools/`; ánh xạ `/` → 404. Content-Type cho `.html .js .mjs .css .json .png .svg`. Không cần `data/`.
- [ ] **Step 4: Chạy test** → PASS.
- [ ] **Step 5: Tạo `tools/fx-bench.html`**: có `<div id="stage"><canvas id="fxCanvas" width="1080" height="1920">` (co về vừa cửa sổ bằng CSS), nạp `/public/js/overlay/particles.js` dạng module, gọi `initParticles`, rồi chạy kịch bản 12 giây: mỗi 600ms gọi `launchMassiveFireworks()` kèm 2 lần `launchFireworkCluster(rnd, rnd, 5, 'royal')`. Ghi thời gian từng khung bằng `requestAnimationFrame`; cuối kịch bản tính `avgFps`, `lowFps1pct` (FPS của 1% khung chậm nhất), `maxFrameMs`, đặt `window.__bench` và in ra trang.
- [ ] **Step 6: Đo gốc.** Chạy `node tools/serve-static.mjs`, mở trang trong Chrome (công cụ Chrome của Claude), chạy 3 lần, ghi trung bình vào `docs/perf/fx-A-results.md` hàng "Gốc" (kèm model máy/Chrome, độ phân giải cửa sổ). Ghi rõ đây là số **Chrome trên máy dev, chỉ để so sánh tương đối**.
- [ ] **Step 7: Commit** `git add tools tests docs/perf && git commit -m "Thêm công cụ đo FPS pháo hoa và số đo gốc"`

---

### Task 2: Bộ điều khiển chất lượng (thuần)

**Files:**
- Create: `public/js/overlay/fx-quality.js`
- Test: `tests/fx-quality.test.mjs`

**Interfaces:**
- Produces: `export const PARTICLE_CAPS = [900, 500, 250]`; `export function createQuality(): { feed(dtMs: number): number; level(): number; cap(): number; reset(): void }`. `level()` ∈ {0 cao, 1 vừa, 2 thấp}; `feed` trả level hiện tại.

- [ ] **Step 1: Viết test thất bại** (đưa vào cùng file test; dùng số khung hình mô phỏng, không dùng đồng hồ thật):
  - `starts at level 0 with cap 900`.
  - `degrades one level after a 2s window averaging above 24ms`: 70 khung × 30ms → `level() === 1`, `cap() === 500`; thêm 70 khung × 30ms → level 2, cap 250; thêm nữa → vẫn 2.
  - `does not degrade at exactly 24ms average`: 120 khung × 24ms → level 0.
  - `recovers one level after a 10s window averaging below 18ms`: từ level 2, 600 khung × 16.7ms → level 1; thêm 600 khung → level 0.
  - `does not recover while average is 18ms or more`: từ level 2, 600 khung × 18ms → vẫn level 2.
  - `ignores stalls`: 100 lần `feed(2000)` và `feed(501)` và `feed(0)` và `feed(-5)` → level vẫn 0.
  - `reset returns to level 0`.
- [ ] **Step 2: Chạy** `node --test tests/fx-quality.test.mjs` → FAIL.
- [ ] **Step 3: Cài `createQuality`**: hai cửa sổ tích lũy theo tổng `dt` (2000ms để giảm, 10000ms để tăng); `dt` ≤ 0 hoặc > 500 bị bỏ qua; mỗi cửa sổ xong thì so trung bình rồi bắt đầu cửa sổ mới; đổi mức thì xóa cả hai cửa sổ.
- [ ] **Step 4: Chạy test** → PASS.
- [ ] **Step 5: Commit** `git add public/js/overlay/fx-quality.js tests/fx-quality.test.mjs && git commit -m "Thêm bộ điều khiển chất lượng hiệu ứng (có test)"`

---

### Task 3: Kho hạt có trần (thuần)

**Files:**
- Create: `public/js/overlay/fx-pool.js`
- Test: `tests/fx-pool.test.mjs`

**Interfaces:**
- Produces: `export function createPool(max: number): { add(init: (p: Particle) => void): boolean; setCap(n: number): void; cap(): number; forEach(fn: (p: Particle) => boolean | void): void; readonly count: number }` với `Particle = { x, y, px, py, vx, vy, alpha, decay, size, gravity, drag, color, spark }`. `forEach` trả `false` từ `fn` nghĩa là giải phóng hạt đó.
- Consumes: không (module thuần, không import DOM).

- [ ] **Step 1: Viết test thất bại:**
  - `add returns false at cap`: cap 3 → 3 lần `true`, lần 4 `false`, `count === 3`.
  - `freed particles are reused`: sau khi `forEach(() => false)`, `count === 0`; thêm lại được; tổng số đối tượng hạt khác nhau từng xuất hiện ≤ `max`.
  - `lowering cap keeps live particles but refuses new ones`: 5 hạt đang sống, `setCap(2)` → `count` vẫn 5, `add` trả `false` cho tới khi `count < 2`.
  - `setCap clamps to [0, max]`: `setCap(10_000)` → `cap() === max`; `setCap(-1)` → `cap() === 0`.
  - `thousands of requests never exceed cap`: cap 900, gọi `add` 5000 lần → `count === 900`.
  - `forEach tolerates freeing during iteration` (xóa vài hạt giữa chừng, không bỏ sót hạt còn lại).
- [ ] **Step 2: Chạy** → FAIL. **Step 3: Cài** bằng mảng hạt cấp phát sẵn + ngăn xếp hạt rảnh; giải phóng bằng hoán đổi-xóa. **Step 4: Chạy** → PASS.
- [ ] **Step 5: Commit** `git add public/js/overlay/fx-pool.js tests/fx-pool.test.mjs && git commit -m "Thêm kho hạt có trần (có test)"`

---

### Task 4: Viết lại `particles.js` (ảnh phát sáng + kho hạt + trần theo chất lượng)

**Files:**
- Create: `public/js/overlay/fx-glow.js`
- Modify: `public/js/overlay/particles.js` (giữ API công khai)

**Interfaces:**
- Consumes: `createPool` (Task 3); `particleCap(): number` và `feedFrame(dtMs: number): void` từ `fx-perf.js` (Task 5 — **làm Task 5 Step 1–3 trước hoặc dùng bản tạm**: nếu chưa có, tạm đặt `fx-perf.js` xuất hai hàm trả 900 và không làm gì, rồi hoàn thiện ở Task 5).
- Produces: `glowSprite(color: string): HTMLCanvasElement` (64×64, gradient tròn từ `color` đậm tới trong suốt, cache theo màu).

- [ ] **Step 1: Cài `fx-glow.js`.**
- [ ] **Step 2: Sửa `particles.js`:** bỏ `Particle` class + mảng `trail` + `shadowBlur`; dùng `createPool(1500)`; mỗi hạt lưu `px,py` (vị trí khung trước) để vẽ vệt bằng một đoạn thẳng; đầu hạt vẽ bằng `drawImage(glowSprite(color), …)` với `globalCompositeOperation = 'lighter'` đặt một lần mỗi khung (nhớ trả về `source-over` cuối khung); trần = `particleCap()`; số hạt mỗi lần bắn nhân hệ số 1 / .6 / .35 theo mức chất lượng; chuyển `body.lite` thành trần 250. Vòng lặp gọi `feedFrame(dt)` mỗi khung. `launchFirework`… vẫn trả `undefined`; khi `ctx` là `null` thì thoát sớm, không lỗi (Review Focus #3).
- [ ] **Step 3: Kiểm tra logic:** `node --test tests/` → tất cả PASS (không đụng test cũ).
- [ ] **Step 4: Đo sau.** Chạy `fx-bench.html` 3 lần, thêm hàng "Sau Task 4" vào `docs/perf/fx-A-results.md`. Chấp nhận khi `avgFps` không thấp hơn gốc và `maxFrameMs` giảm; nếu không → dừng, báo người dùng, không tiếp tục.
- [ ] **Step 5: Kiểm tra mắt:** chụp ảnh bản gốc (`git stash`/checkout `HEAD~` vào thư mục tạm không dùng) và bản mới ở khoảnh khắc đỉnh pháo hoa; xác nhận độ sáng/độ lung linh không kém hơn (nếu kém: tăng kích thước/độ đục ảnh phát sáng cho tới khi tương đương). Kiểm tra khi canvas bị co giãn CSS vẫn đúng (Review Focus #4).
- [ ] **Step 6: Kiểm tra không rAF nền:** trong Chrome, sau khi hết hạt, xác nhận `requestAnimationFrame` không còn được gọi (đếm bằng cách bọc `window.requestAnimationFrame` trong console, đợi 3 giây).
- [ ] **Step 7: Commit** `git add public/js/overlay && git commit -m "Pháo hoa: bỏ shadowBlur, dùng ảnh phát sáng và kho hạt có trần"`

---

### Task 5: Nối chất lượng với trình duyệt + bộ FPS `?fps=1`

**Files:**
- Create: `public/js/overlay/fx-perf.js`, `public/css/fx-perf.css`
- Modify: `public/overlay.html` (thêm `<link rel="stylesheet" href="css/fx-perf.css">` sau `regions-modal.css`)

**Interfaces:**
- Produces: `feedFrame(dtMs: number): void`; `particleCap(): number` (đã tính `body.lite` → 250); `qualityLevel(): number`. Khi mức đổi, đặt `document.documentElement.dataset.q = '0'|'1'|'2'` và `console.info('[fx] chất lượng:', level)`. Nếu URL có `fps=1`: tạo hộp cố định góc trên trái hiện `FPS` và mức chất lượng, cập nhật mỗi 500ms bằng rAF riêng (chỉ khi có tham số).

- [ ] **Step 1:** Cài `fx-perf.js` dùng `createQuality()`. **Step 2:** `fx-perf.css`: `html[data-q="1"] .sea-wave, html[data-q="1"] .sea-coast { display: none }` (lớp blur + `mix-blend-mode`); `html[data-q="2"]` thêm `#tilt { animation: none }` và `.card, #banner { backdrop-filter: none }`. (Chỉ giữ từng dòng nếu Task 6 đo thấy có lợi.) **Step 3:** `node --test tests/` → PASS; mở overlay tĩnh `http://127.0.0.1:5173/public/overlay.html?fps=1` (kết nối socket sẽ lỗi, bỏ qua) và xác nhận thấy FPS.
- [ ] **Step 4: Kiểm tra Review Focus #5:** không có `?fps=1` → không có rAF chạy nền khi rảnh (cách bọc rAF như Task 4 Step 6).
- [ ] **Step 5: Ép máy yếu:** bật Chrome CPU throttling 6× (DevTools) khi chạy `fx-bench.html` → quan sát `data-q` tụt xuống 1/2 và FPS khá hơn; tắt throttling, đợi → mức phục hồi.
- [ ] **Step 6: Commit** `git add public && git commit -m "Tự giảm chất lượng hiệu ứng theo FPS và thêm bộ đo ?fps=1"`

---

### Task 6: Giảm lớp CSS nặng (chỉ giữ thay đổi đo được là có lợi)

**Files:**
- Modify: `public/css/fx-perf.css`, `docs/perf/fx-A-results.md`

**Interfaces:** Consumes `?fps=1` (Task 5). Không đổi JS.

- [ ] **Step 1: Đo gốc tĩnh:** mở `overlay.html?fps=1` ở cửa sổ 1080×1920 (hoặc thu nhỏ tỷ lệ), ghi FPS rảnh khi chưa có hiệu ứng, và FPS khi chạy `launchMassiveFireworks` bằng cách import module trong console.
- [ ] **Step 2: Thử từng ứng viên, một lần một cái** bằng cách chèn `<style>` trong console: (a) bỏ `backdrop-filter` của `.card` (`overlay.css:171`) và `#banner` (`overlay.css:257`); (b) tắt `filter: blur` + `mix-blend-mode` của `.sea-wave` / `.sea-coast` (`overlay.css` quanh 575–585, 626–634); (c) chuyển hoạt ảnh `box-shadow` (`@keyframes glowF`, `@keyframes avatarGlow`, `#lastCard.hot`) sang lớp `::after` có `box-shadow` cố định và chỉ animate `opacity`. Ghi FPS và ảnh chụp của từng thử nghiệm.
- [ ] **Step 3: Giữ** thay đổi nếu (FPS tăng ≥ 5%) **hoặc** (nhìn không khác). (a) nếu chữ trong thẻ khó đọc hơn khi nền bản đồ sáng: tăng độ đục `--card` tới khi tương đương. Đưa phần giữ lại vào `fx-perf.css`/`overlay.css`; bỏ phần không có lợi.
- [ ] **Step 4:** Kiểm tra cả 8 theme và `body.lite` nhìn như trước (đặt `?theme=…` trên URL; theme tải từ máy chủ có thể chưa có gói → chỉ kiểm tra theme có sẵn).
- [ ] **Step 5: Hoàn thiện `docs/perf/fx-A-results.md`** (bảng Gốc / Sau Task 4 / Sau Task 6, và ghi những ứng viên đã bỏ vì không đo được lợi).
- [ ] **Step 6: Commit** `git add public docs && git commit -m "CSS: giảm lớp blur và hoạt ảnh box-shadow nặng (theo số đo)"`

---

### Task 7: Bàn giao cho người dùng đo trong LIVE Studio

**Files:** `DOC-TRUOC.txt` (thêm 2 dòng hướng dẫn)

- [ ] **Step 1:** Thêm vào `DOC-TRUOC.txt` cách thêm `?fps=1` vào đường dẫn overlay trong LIVE Studio để đọc FPS thật, và cách đọc mức chất lượng tự động.
- [ ] **Step 2:** `node --test tests/` → toàn bộ PASS; `git status` sạch; **Commit** `git add DOC-TRUOC.txt && git commit -m "Hướng dẫn đo FPS trong LIVE Studio"`.
- [ ] **Step 3:** Báo người dùng kết quả (bảng trước/sau) và nhờ họ mở overlay với `?fps=1` trong LIVE Studio khi có quà dồn dập, gửi lại số FPS để chốt ngưỡng; sau đó lập kế hoạch cho Phần B.

## Self-Review

- **Spec coverage (phần A):** đo + `?fps=1` → Task 1, 5; bỏ `shadowBlur`/kho hạt/trần → Task 3, 4; tự giảm chất lượng → Task 2, 5; CSS → Task 5, 6. Bản quyền/auto-pacing không bị đụng.
- **Type consistency:** `createQuality().cap()`/`PARTICLE_CAPS` (Task 2) được `fx-perf.js` dùng để cấp `particleCap()` (Task 5); `createPool` (Task 3) dùng ở Task 4; `feedFrame`/`particleCap` thống nhất giữa Task 4 và 5.
- **Thứ tự:** Task 4 cần `fx-perf.js` nên cho phép bản tạm ở Task 4 và hoàn thiện ở Task 5.
