# Cấp độ + Vượt hạng + Nhiệm vụ 60 giây — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Tôn vinh người tặng quà (cấp độ + khung ảnh, cảnh "vượt hạng") và kéo cả phòng cùng tương tác (nhiệm vụ 60 giây).

**Architecture:** Logic thuần trong `src/domain/` (test bằng `node --test`), nối vào `game.mjs` bằng vài dòng, sự kiện phát xuống overlay qua `broadcast`, overlay vẽ bằng file mới (`transform`/`opacity` only). Mọi tính năng có cài đặt riêng trong bảng điều khiển.

**Tech Stack:** Node 23 ESM, JS/CSS thuần, WAAPI. Không thêm thư viện.

## Global Constraints

- File chủ kênh đang sửa dở (KHÔNG commit, KHÔNG `git add`, chỉ sửa hunk nhỏ bằng Edit hoặc script Node dò kiểu xuống dòng; nhiều file là CRLF; **cấm `sed -i`**): `public/control.html`, `public/css/fx-perf.css`, `public/css/overlay.css`, `public/js/overlay/fx.js`, `public/js/overlay/theme.js`, `public/overlay.html`, `src/domain/game.mjs`, `src/domain/settings.mjs`. File còn lại (kể cả `main.js`, `render.js`, `server.mjs`) sạch và được commit bằng đường dẫn rõ ràng (không `git add -A`).
- Chỉ tính người thật: bỏ qua uid bắt đầu bằng `auto_` hoặc `demo` (`isBotUid` trong `game.mjs`).
- Không chạy `node server.mjs`; test: `node --test` (hiện 57 đạt). Không `Co-Authored-By`. Không động `auto-pacing`, bản quyền, `data/`.
- Overlay: chỉ animate `transform`/`opacity`; không `filter` hay `box-shadow` động; tắt khi `isLite()`; bỏ phần nặng khi `qualityLevel() >= 2`; mọi tên người xem đặt bằng `textContent`.
- Mỗi tính năng bật/tắt được trong bảng điều khiển (`data-k`), không dùng tham số URL.

## Giá trị đã chốt (cài đặt, tất cả trong `settings.mjs` + `RULES`)

| Khóa | Mặc định | Giới hạn |
|---|---|---|
| `levelOn` | true | bool |
| `levelTiers` | `'10,100,500,2000'` | chuỗi 4 số tăng dần (xu cộng dồn cả buổi) → cấp 1 Đồng, 2 Bạc, 3 Vàng, 4 Kim cương |
| `overtakeOn` | true | bool |
| `missionOn` | false | bool |
| `missionEveryMin` | 8 | 2–120 |
| `missionSec` | 60 | 20–300 |
| `missionTarget` | 30 | 5–1000 |
| `missionPts` | 300 | 0–10000 (điểm thưởng cho quê trúng nhiệm vụ) |

## Review Focus

1. Quà dồn dập từ nhiều người: không lặp `levelUp`/`overtake` cho cùng một lần vượt mốc; hạng không nhảy lung tung khi đồng hạng.
2. Người xem ảo (`auto_`, `demo`) không bao giờ đóng góp vào cấp, hạng hay nhiệm vụ.
3. Nhiệm vụ: không bắt đầu khi đang có Đại chiến / câu đố / rương; một người không thể tự hoàn thành (trần mỗi người); hết giờ phát đúng một kết quả.
4. Tên chứa HTML hiện như chữ thường trên overlay.
5. Bật/tắt cài đặt giữa chừng không để lại phần tử mồ côi hay timer.

---

### Task 1: Logic thuần + test (3 module)

**Files:** Create `src/domain/levels.mjs`, `src/domain/ranking.mjs`, `src/domain/mission-logic.mjs`, và `tests/levels.test.mjs`, `tests/ranking.test.mjs`, `tests/mission-logic.test.mjs`.

**Interfaces (Produces):**
- `levels.mjs`: `export const LEVEL_NAMES = ['', 'Đồng', 'Bạc', 'Vàng', 'Kim cương']`; `export const DEFAULT_TIERS = [10, 100, 500, 2000]`; `parseTiers(str): number[]` (4 số dương tăng dần; sai định dạng, thiếu, không tăng, NaN → `DEFAULT_TIERS`); `levelOf(coins, tiers): 0|1|2|3|4` (so với từng mốc, `>=`; coins không hợp lệ hoặc <= 0 → 0); `nextInfo(coins, tiers): { level, name, next, need }` với `name = LEVEL_NAMES[level]`, `next` là tên cấp kế tiếp hoặc `null` ở cấp 4, `need` là số xu còn thiếu để lên cấp kế (0 ở cấp 4).
- `ranking.mjs`: `rankList(donors, n = 10): Array<{uid,name,avatar,coins}>` từ object `S.donors` (key = uid, value `{name,avatar,coins}`), sắp `coins` giảm dần, đồng hạng theo `name` tăng dần (localeCompare) rồi `uid`, bỏ `coins <= 0`/không phải số, `avatar` mặc định `''`; `detectOvertake(before, after, uid, maxRank = 5): null | { rank, passed: {uid,name,avatar} | null }` — `rank` = vị trí 1-based của `uid` trong `after`; trả `null` nếu `rank > maxRank`, hoặc `uid` có trong `before` với hạng cũ <= hạng mới (không tiến bộ); `passed` = người đứng ngay dưới `uid` trong `after` mà trước đó ở trên `uid` (hoặc `uid` chưa có trong `before`), không có thì `null`.
- `mission-logic.mjs`: `createMission({ target, durationMs, perUserCap = 5 }): { begin(nowMs, label), hit(uid, nowMs): boolean, tick(nowMs): 'idle'|'running'|'won'|'lost', view(nowMs): { active, label, count, target, leftMs, state } }`. `hit` chỉ tính khi đang chạy, chưa hết giờ, mỗi uid tối đa `perUserCap` lượt, trả `true` nếu được tính; `tick` trả `'won'` đúng một lần khi `count >= target` (kết thúc ngay), `'lost'` đúng một lần khi hết giờ chưa đủ, sau đó `'idle'`; `begin` khi đang chạy thì bỏ qua.

- [ ] Step 1: viết test thất bại cho cả 3 module (biên cấp 9/10/99/100/499/500/1999/2000, `parseTiers` sai định dạng, `nextInfo` ở cấp 0 và cấp 4; `rankList` đồng hạng/rỗng/`coins` không hợp lệ/không đột biến input; `detectOvertake` các trường hợp: tiến lên, vào top 5 từ ngoài, không tiến bộ, ngoài top 5, `passed` đúng người, input rỗng; nhiệm vụ: thắng sớm một lần, thua đúng một lần, trần mỗi người, `hit` sau khi hết giờ, `begin` hai lần, `view` đếm ngược không âm).
- [ ] Step 2: chạy `node --test` → FAIL. Step 3: cài đặt 3 module (thuần, không import DOM/Node). Step 4: `node --test` → PASS.
- [ ] Step 5: commit `git add src/domain/levels.mjs src/domain/ranking.mjs src/domain/mission-logic.mjs tests/levels.test.mjs tests/ranking.test.mjs tests/mission-logic.test.mjs` — "Logic thuần cho cấp độ, vượt hạng, nhiệm vụ (có test)".

---

### Task 2: Nối máy chủ

**Files:** Create `src/domain/mission.mjs` (chạy nhiệm vụ). Modify: `src/domain/settings.mjs` (khóa + RULES), `src/domain/game.mjs` (hunk nhỏ; KHÔNG commit), `server.mjs` (khởi động vòng nhiệm vụ; commit được).

**Interfaces:** Consumes Task 1. Produces: sự kiện `broadcast`:
- `{ t: 'gift', ..., lv, lvName, lvNext, lvNeed }` thêm 4 trường vào hai chỗ phát `gift` hiện có (có quê / chưa có quê) cho người thật.
- `{ t: 'levelUp', name, avatar, level, levelName, next, need, prov }` (khi tổng xu cộng dồn vượt mốc cấp, đúng một lần mỗi cấp).
- `{ t: 'overtake', name, avatar, rank, passedName, passedAvatar }`.
- `{ t: 'missionWin', prov, count, target }` và `{ t: 'missionEnd', won: false, count, target }`.
- `snapshot()`: `donors` mỗi phần tử thêm `level`; thêm `mission: missionView()` (null khi không chạy); `rules` thêm `levelTiers`, `levelOn`.
- `mission.mjs` export: `startMissionLoop(): void`, `missionOnChat(uid, provs: string[]): void`, `missionView(): null | { active, label, prov, count, target, leftMs, endsAt, now }`.

- [ ] Step 1 (`game.mjs`, `onGift`): trước khi cộng `D.coins` lấy `rkBefore = rankList(S.donors)` (chỉ người thật); sau khi cộng tính cấp cũ/mới bằng `levelOf` với `parseTiers(settings.levelTiers)`, và `detectOvertake(rkBefore, rankList(S.donors), uid)`; nếu `settings.levelOn && newLevel > oldLevel` phát `levelUp` và `say([...], { tag: 'gift' })` ("<tên> lên cấp <Vàng>! Còn <need> xu nữa lên <Kim cương>." ở cấp 4: "<tên> đã đạt cấp Kim cương!"); nếu `settings.overtakeOn` và có `overtake` phát `overtake` và `say` ("<A> vượt <B> lên hạng <n>!" hoặc "<A> vào top <n>!"). Gửi trễ 700 ms bằng `setTimeout` để banner quà hiện trước. Thêm trường `lv…` vào hai `broadcast({ t: 'gift' ...})`.
- [ ] Step 2 (`game.mjs`, `onChat`): ngay sau `const provs = findProvinces(text);` thêm `if (!isBotUid(uid)) missionOnChat(uid, provs);`.
- [ ] Step 3: `mission.mjs`: vòng 1 giây; chỉ bắt đầu khi `settings.missionOn`, đã tới giờ (`missionEveryMin`), không có `duelView()`/`quizActive()`/`isChestActive()`, và có hoạt động thật trong 2 phút gần nhất (`Date.now() - S.lastAct < 120000`), nếu không hoãn 30 giây; chọn ngẫu nhiên một tỉnh trong `NAMES`; nhãn `Comment "<tên tỉnh>"`; `missionOnChat` gọi `hit` khi `provs.includes(prov)`; khi `tick` ra `'won'`: `addBonusPts(prov, settings.missionPts)` (nếu > 0), phát `missionWin`, `say(...)`; `'lost'`: phát `missionEnd`, `say` động viên ngắn; tắt `missionOn` giữa chừng thì hủy nhiệm vụ đang chạy êm (phát `missionEnd` không thưởng).
- [ ] Step 4: `settings.mjs`: thêm 8 khóa và `RULES` đúng bảng trên (`levelTiers: v => String(v||'').replace(/[^\d,]/g,'').slice(0,40) || '10,100,500,2000'`). `server.mjs`: import và gọi `startMissionLoop()` cạnh `startQuizLoop()`.
- [ ] Step 5: `node --check` các file, `node --test` PASS. Commit `src/domain/mission.mjs server.mjs` (KHÔNG commit `game.mjs`/`settings.mjs`).

---

### Task 3: Overlay

**Files:** Create `public/js/overlay/fx-donors.js` + `public/css/fx-donors.css` (khung ảnh theo cấp, thẻ lên cấp, cảnh vượt hạng), `public/js/overlay/fx-mission.js` + `public/css/fx-mission.css`. Modify `public/js/overlay/main.js`, `public/js/overlay/render.js` (hunk nhỏ ở bục vinh danh; cả hai sạch, commit được).

**Interfaces:** Consumes sự kiện Task 2. Produces: `levelClass(level): string` (`''` cho 0, `'lv1'`…`'lv4'`), `showLevelUp(ev)`, `showOvertake(ev)`, `applyBannerFrame(level)` (trong `fx-donors.js`); `renderMission(view)`, `missionWin(ev)`, `missionEnd(ev)` (trong `fx-mission.js`). Mỗi module tự nạp CSS riêng như `fx-cinema.js` (đọc file đó để theo mẫu: WAAPI, dọn đúng một lần, `createBudget`).

- [ ] Step 1 — khung ảnh: lớp `.lv1`–`.lv4` đổi viền/vòng sáng tĩnh cho ảnh (`.bav`, `.pav`, ảnh trong kính lúp `.lens`): Đồng #cd7f32, Bạc #cfd8e3, Vàng #ffd24a, Kim cương #7fe8ff kèm huy hiệu nhỏ ◆; áp cho banner quà (`main.js` handler `gift`: sau `banner(...)` gọi `applyBannerFrame(m.lv)`, và dòng phụ banner thêm ` · còn ${m.lvNeed} xu lên ${m.lvNext}` khi `m.lvNext`), bục vinh danh (`render.js`, `d[i].level`), kính lúp (`fx-lens.js` nhận thêm `level`).
- [ ] Step 2 — `showLevelUp({name, avatar, level, levelName, next, need})`: thẻ giữa trên (khoảng y 250–360, giữa chiều ngang) trượt xuống, ảnh có khung cấp mới, chữ "LÊN CẤP <TÊN CẤP>!" và dòng "còn X xu lên <cấp kế>"; 3.2 giây; tối đa 1 thẻ cùng lúc (cái sau chờ tối đa 1 hàng đợi, bỏ phần dư).
- [ ] Step 3 — `showOvertake({name, avatar, rank, passedName, passedAvatar})`: dải ngang rộng 900 px ở khoảng y 640 (giữa tiêu đề quà lớn ~y 400 và banner y 780), hai ảnh + ⚡ + chữ "<A> VƯỢT <B> · HẠNG <n>"; vào bằng `translateX`, ⚡ phóng nhẹ, 2.8 giây; gọi `screenShake('sm')` và `playSfx('thunder')` (cả hai đã export, xem `main.js`); tối đa 1 cảnh cùng lúc.
- [ ] Step 4 — nhiệm vụ: `renderMission(view)` (gọi mỗi lần nhận `state`, `view` có thể `null`): thẻ nhỏ góc trái trên (khoảng x 24–424, y 250–350, chọn chỗ không đè bản đồ/tiêu đề/thẻ phải), có nhãn, thanh tiến độ (`transform: scaleX`), đếm ngược `leftMs` trừ thời gian đã trôi kể từ lúc nhận (`performance.now()`), "Còn X/N"; ẩn khi `view` null. `missionWin`: pháo hoa trên tỉnh (`launchFireworkCluster` từ `particles.js` tại `stagePt(prov)` từ `theme-fx.js`), banner "🎯 NHIỆM VỤ HOÀN THÀNH" qua `banner()` của `fx.js`; `missionEnd`: thẻ chuyển "Chưa đủ lần này" 2 giây rồi ẩn.
- [ ] Step 5 — `main.js`: import ba module; handler `levelUp: showLevelUp`, `overtake: showOvertake`, `missionWin`, `missionEnd`; trong handler `state` thêm `renderMission(s.mission)`. Không đổi gì khác.
- [ ] Step 6: `node --check` bản sao tạm của từng file JS; `node --test` PASS. Commit đúng các file mới + `main.js` + `render.js`.
- [ ] Step 7 (controller, trình duyệt): trạng thái giả + gọi trực tiếp hàm, chụp ảnh từng hiệu ứng, kiểm tra tên chứa `<img onerror>`, kiểm tra không còn phần tử mồ côi sau vài giây.

---

### Task 4: Bảng điều khiển (controller làm, không commit)

`public/control.html`: ô `levelOn`, `levelTiers` (văn bản), `overtakeOn`, `missionOn`, `missionEveryMin`, `missionSec`, `missionTarget`, `missionPts`, đặt gần ô "Kính lúp"/ "Vòng đua & điểm", theo mẫu `data-k`. Nhắc chủ kênh khởi động lại `CHAY.bat` để máy chủ nhận cài đặt mới.
